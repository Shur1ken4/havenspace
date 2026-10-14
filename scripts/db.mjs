// Runs a local Postgres for development, stored in .data/postgres.
// No Docker needed. Stop it with Ctrl+C.
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { existsSync } from "node:fs";
import { ROOT, loadEnv } from "./env.mjs";

loadEnv();
const port = Number(process.env.LOCAL_PG_PORT || 54329);
const dir = path.join(ROOT, ".data", "postgres");
const fresh = !existsSync(dir);

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: process.env.LOCAL_PG_SUPERUSER_PASSWORD || "postgres",
  port,
  persistent: true,
  // UTF-8 so names and notes in any language (e.g. Russian) are stored correctly.
  initdbFlags: ["--encoding=UTF8", "--locale=C.UTF-8"],
  onLog: () => {},
});

if (fresh) await pg.initialise();
await pg.start();
for (const db of ["psych", "psych_test"]) {
  try { await pg.createDatabase(db); } catch { /* already exists */ }
}
console.log(`Local Postgres is running on port ${port} (databases: psych, psych_test). Press Ctrl+C to stop.`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
