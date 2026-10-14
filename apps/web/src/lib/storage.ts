import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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

let store: ObjectStore | undefined;
export function storage(): ObjectStore {
  return (store ??= process.env.STORAGE_DRIVER === "s3" ? new S3Store() : new LocalStore());
}
