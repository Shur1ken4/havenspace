import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { withUser } from "./db";

// Short-lived audio storage. "local" for development, "s3" for any
// S3-compatible EU object storage in production. Keys look like
// "audio/<therapist>/<session>/<track>/<segment>-<seq>.webm".
export interface ObjectStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(keys: string[]): Promise<void>;
}

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, "db", "migrations"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function safeKey(key: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("invalid storage key");
  return key;
}

class LocalStore implements ObjectStore {
  private base = path.resolve(repoRoot(), process.env.LOCAL_STORAGE_DIR ?? ".data/storage");
  async put(key: string, body: Uint8Array) {
    const file = path.join(this.base, safeKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(path.join(this.base, safeKey(key))));
  }
  async remove(keys: string[]) {
    await Promise.all(keys.map((k) => rm(path.join(this.base, safeKey(k)), { force: true })));
  }
}

class S3Store implements ObjectStore {
  private clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  }));
  private bucket = process.env.S3_BUCKET!;
  async put(key: string, body: Uint8Array, contentType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new PutObjectCommand({
      Bucket: this.bucket, Key: safeKey(key), Body: body, ContentType: contentType, ServerSideEncryption: "AES256",
    }));
  }
  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    return new Uint8Array(await res.Body!.transformToByteArray());
  }
  async remove(keys: string[]) {
    const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    for (let i = 0; i < keys.length; i += 1000) {
      await (await this.clientPromise).send(new DeleteObjectsCommand({
        Bucket: this.bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key: safeKey(Key) })) },
      }));
    }
  }
}

/** Pilot fallback: objects live in Postgres (blob_store), owned via the key's
 *  "<kind>/<user>/" prefix and row-level security. Callers authorise first. */
class DbStore implements ObjectStore {
  private owner(key: string) {
    const m = /^(?:audio|documents)\/([^/]+)\//.exec(safeKey(key));
    if (!m) throw new Error("invalid storage key");
    return m[1];
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    await withUser(this.owner(key), (db) => db.query(
      "insert into blob_store (key, body, mime) values ($1, $2, $3) on conflict (key) do update set body = excluded.body, mime = excluded.mime",
      [key, Buffer.from(body), contentType],
    ));
  }
  async get(key: string) {
    const { rows } = await withUser(this.owner(key), (db) => db.query("select body from blob_store where key = $1", [key]));
    if (!rows[0]) throw new Error("not found");
    return new Uint8Array(rows[0].body as Buffer);
  }
  async remove(keys: string[]) {
    const byOwner = new Map<string, string[]>();
    for (const k of keys) byOwner.set(this.owner(k), [...(byOwner.get(this.owner(k)) ?? []), k]);
    for (const [owner, ks] of byOwner) await withUser(owner, (db) => db.query("delete from blob_store where key = any($1)", [ks]));
  }
}

let store: ObjectStore | undefined;
export function storage(): ObjectStore {
  const driver = process.env.STORAGE_DRIVER;
  return (store ??= driver === "s3" ? new S3Store() : driver === "db" ? new DbStore() : new LocalStore());
}
