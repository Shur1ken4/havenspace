// Runs the processing worker on this computer for the live pilot (Neon database),
// until a dedicated EU server runs it (docs/pilot-setup.md, step 3).
//   node scripts/worker-pilot.mjs
// Sessions are processed only while this runs (keep the Mac awake). Ctrl+C stops it.
// Reads the private values in .env.production and .env.production.secrets; prints none of them.
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./env.mjs";

function parse(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const p = parse(path.join(ROOT, ".env.production"));
const s = parse(path.join(ROOT, ".env.production.secrets"));
const missing = ["NEON_OWNER_URL", "ANTHROPIC_API_KEY"].filter((k) => !p[k]).concat(s.WORKER_DB_PASSWORD ? [] : ["WORKER_DB_PASSWORD"]);
if (missing.length) { console.error(`Missing: ${missing.join(", ")}`); process.exit(1); }

// The worker's own database login, connecting directly (not through Neon's pooler).
const u = new URL(p.NEON_OWNER_URL);
u.hostname = u.hostname.replace(/^([^.]+?)(-pooler)?\./, "$1.");
u.username = "worker_user";
u.password = s.WORKER_DB_PASSWORD;
u.searchParams.set("sslmode", "require");
u.searchParams.delete("channel_binding");

const env = {
  ...process.env,
  WORKER_DATABASE_URL: u.toString(),
  STORAGE_DRIVER: "db", // pilot: audio is kept in Postgres until EU object storage
  ALLOW_REAL_CLIENT_DATA: "false",
  LIVE_RESEARCH_EMAILS: p.LIVE_RESEARCH_EMAILS ?? "",
  LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: p.ANTHROPIC_API_KEY,
  LLM_MODEL: "claude-opus-5-5", LIVE_MODEL: "claude-sonnet-5-5", LIVE_WHISPER_MODEL: "small",
  WHISPER_MODEL: "large-v3-turbo", WHISPER_DEVICE: "cpu", WHISPER_COMPUTE_TYPE: "int8",
};
const uv = path.join(os.homedir(), ".local", "bin", "uv");
console.log("Processing worker for the live pilot is starting. Keep this running (Ctrl+C stops it).");
const child = spawn(uv, ["run", "python", "-m", "worker"], { cwd: path.join(ROOT, "services", "worker"), env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
