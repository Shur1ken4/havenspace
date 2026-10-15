// One command for local use: starts the database, applies any new database
// changes, then runs the web app and the background worker together.
// Stop everything with Ctrl+C.
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { ROOT, loadEnv } from "./env.mjs";

loadEnv();
const port = Number(process.env.LOCAL_PG_PORT || 54329);
const uv = path.join(os.homedir(), ".local", "bin", "uv");
const children = [];

function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PYTHONWARNINGS: "ignore", PYTHONUNBUFFERED: "1" }, ...opts });
  const tag = `[${name}]`.padEnd(9);
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => console.log(`${tag} ${l}`)));
  }
  children.push(child);
  return child;
}

const portOpen = () => new Promise((resolve) => {
  const s = net.connect(port, "127.0.0.1", () => { s.end(); resolve(true); });
  s.on("error", () => resolve(false));
});

if (!(await portOpen())) {
  run("db", "node", ["scripts/db.mjs"]);
  for (let i = 0; i < 60 && !(await portOpen()); i++) await wait(500);
}
await new Promise((resolve, reject) => run("migrate", "node", ["scripts/migrate.mjs"]).on("exit", (c) => (c === 0 ? resolve() : reject(new Error("migration failed")))));
run("web", "npm", ["run", "dev", "-w", "web"]);
run("worker", uv, ["run", "python", "-m", "worker"], { cwd: path.join(ROOT, "services", "worker") });
console.log(`\n  Psych Copilot is starting at ${process.env.APP_URL}\n  Sign-in links appear at ${process.env.APP_URL}/dev/mailbox\n  Press Ctrl+C to stop.\n`);

const stop = () => { children.forEach((c) => c.kill("SIGTERM")); setTimeout(() => process.exit(0), 1500); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
