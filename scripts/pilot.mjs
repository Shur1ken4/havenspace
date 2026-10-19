// Pilot deployment helper. Reads the private values Shurik pasted into
// .env.production (see docs/pilot-setup.md), generates the app's own secrets
// once (.env.production.secrets), and then:
//   node scripts/pilot.mjs check    -> what is still missing
//   node scripts/pilot.mjs migrate  -> create tables, security rules and logins in Neon
//   node scripts/pilot.mjs vercel   -> write .env.vercel (paste into Vercel → Environment Variables)
//   node scripts/pilot.mjs worker   -> install / update the speech-to-text worker on the Hetzner server
//   node scripts/pilot.mjs admin <email> -> let that person approve therapists on /admin
// Nothing here prints a password or key.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "./env.mjs";

const PROD = path.join(ROOT, ".env.production");
const SECRETS = path.join(ROOT, ".env.production.secrets");
const SSH_KEY = path.join(process.env.HOME, ".ssh", "couchnote_hetzner");

function parse(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const write = (file, obj, header) =>
  writeFileSync(file, `${header}\n${Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n")}\n`, { mode: 0o600 });

const p = parse(PROD);
let s = parse(SECRETS);
if (!s.BETTER_AUTH_SECRET) {
  const pw = () => randomBytes(24).toString("base64url");
  s = { BETTER_AUTH_SECRET: randomBytes(32).toString("base64"), APP_DB_PASSWORD: pw(), WORKER_DB_PASSWORD: pw() };
  write(SECRETS, s, "# Generated once by scripts/pilot.mjs. Private: never share or commit.");
}

const NEEDED = {
  check: ["NEON_OWNER_URL", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "WORKER_SERVER_IP", "ANTHROPIC_API_KEY", "APP_URL"],
  migrate: ["NEON_OWNER_URL"],
  vercel: ["NEON_OWNER_URL", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
  admin: ["NEON_OWNER_URL"],
  worker: ["NEON_OWNER_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "WORKER_SERVER_IP", "ANTHROPIC_API_KEY"],
};
const cmd = process.argv[2] ?? "check";
if (!NEEDED[cmd]) { console.error("usage: node scripts/pilot.mjs check|migrate|vercel|worker|admin <email>"); process.exit(1); }
const missing = NEEDED[cmd].filter((k) => !p[k]);
if (cmd === "check") {
  for (const k of NEEDED.check) console.log(`${p[k] ? "✓" : "·"} ${k}${p[k] ? "" : "  (missing)"}`);
  process.exit(0);
}
if (missing.length) { console.error(`Still missing in .env.production: ${missing.join(", ")}`); process.exit(1); }

// Neon gives one owner connection string. Logins for the app and worker use the
// same database with their own users; the app goes through Neon's connection
// pooler (many short serverless connections), the others connect directly.
function dbUrl(user, password, pooled) {
  const u = new URL(p.NEON_OWNER_URL);
  const [first, ...rest] = u.hostname.split(".");
  const base = first.replace(/-pooler$/, "");
  u.hostname = [pooled ? `${base}-pooler` : base, ...rest].join(".");
  if (user) { u.username = user; u.password = password; }
  u.searchParams.set("sslmode", "require");
  u.searchParams.delete("channel_binding");
  return u.toString();
}
const owner = dbUrl(null, null, false);
const appDb = dbUrl("app_user", s.APP_DB_PASSWORD, true);
const workerDb = dbUrl("worker_user", s.WORKER_DB_PASSWORD, false);
const s3 = {
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: p.S3_ENDPOINT || "https://fsn1.your-objectstorage.com",
  S3_REGION: new URL(p.S3_ENDPOINT || "https://fsn1.your-objectstorage.com").hostname.split(".")[0],
  S3_BUCKET: p.S3_BUCKET, S3_ACCESS_KEY_ID: p.S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: p.S3_SECRET_ACCESS_KEY,
};
const common = { ALLOW_REAL_CLIENT_DATA: "false", LIVE_RESEARCH_EMAILS: p.LIVE_RESEARCH_EMAILS ?? "" };

if (cmd === "migrate") {
  execFileSync("node", [path.join(ROOT, "scripts", "migrate.mjs")], {
    stdio: "inherit",
    env: { ...process.env, MIGRATION_DATABASE_URL: owner, APP_DB_PASSWORD: s.APP_DB_PASSWORD, WORKER_DB_PASSWORD: s.WORKER_DB_PASSWORD },
  });
}

if (cmd === "admin") {
  execFileSync("node", [path.join(ROOT, "scripts", "admin.mjs"), "add", process.argv[3] ?? ""], {
    stdio: "inherit", env: { ...process.env, MIGRATION_DATABASE_URL: owner },
  });
}

if (cmd === "vercel") {
  const env = {
    ...common, ...s3,
    APP_URL: p.APP_URL || "https://REPLACE-WITH-YOUR-VERCEL-LINK.vercel.app",
    DATABASE_URL: appDb,
    BETTER_AUTH_SECRET: s.BETTER_AUTH_SECRET,
    EMAIL_TRANSPORT: "smtp",
    EMAIL_FROM: `"CouchNote" <${p.GMAIL_ADDRESS}>`,
    SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587", SMTP_USER: p.GMAIL_ADDRESS, SMTP_PASS: p.GMAIL_APP_PASSWORD.replace(/\s/g, ""),
  };
  write(path.join(ROOT, ".env.vercel"), env, "# Paste everything below into Vercel → Project → Settings → Environment Variables. Private.");
  console.log(`Wrote .env.vercel (${Object.keys(env).length} settings). Open it, copy all, paste into Vercel.`);
}

if (cmd === "worker") {
  const env = {
    ...common, ...s3,
    WORKER_DATABASE_URL: workerDb,
    LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: p.ANTHROPIC_API_KEY,
    LLM_MODEL: "claude-opus-5-5", LIVE_MODEL: "claude-sonnet-5-5", LIVE_WHISPER_MODEL: "small",
    WHISPER_MODEL: "large-v3-turbo", WHISPER_DEVICE: "cpu", WHISPER_COMPUTE_TYPE: "int8",
    MODELS_DIR: "/opt/couchnote/.data/models",
  };
  const envFile = path.join(ROOT, ".env.worker");
  write(envFile, env, "# Settings for the worker on the Hetzner server. Private.");
  const host = `root@${p.WORKER_SERVER_IP}`;
  const ssh = ["-i", SSH_KEY, "-o", "StrictHostKeyChecking=accept-new"];
  const run = (c, a) => execFileSync(c, a, { stdio: "inherit", cwd: ROOT });
  console.log("Copying the worker to the server…");
  run("ssh", [...ssh, host, "mkdir -p /opt/couchnote/services /opt/couchnote/packages /opt/couchnote/evals"]);
  run("rsync", ["-az", "--delete", "-e", `ssh ${ssh.join(" ")}`, "--exclude", ".venv", "--exclude", ".data", "--exclude", "__pycache__",
    "--exclude", ".pytest_cache", "services/worker", `${host}:/opt/couchnote/services/`]);
  run("rsync", ["-az", "--delete", "-e", `ssh ${ssh.join(" ")}`, "packages/shared", `${host}:/opt/couchnote/packages/`]);
  run("rsync", ["-az", "-e", `ssh ${ssh.join(" ")}`, "evals/forbidden_terms.txt", `${host}:/opt/couchnote/evals/`]);
  run("scp", [...ssh, envFile, `${host}:/opt/couchnote/.env`]);
  console.log("Installing and (re)starting…");
  execFileSync("ssh", [...ssh, host, "bash -s"], { stdio: ["pipe", "inherit", "inherit"], input: REMOTE_SETUP });
  console.log("Worker is running. Logs: ssh -i ~/.ssh/couchnote_hetzner " + host + " journalctl -u couchnote-worker -f");
}

// Runs on the server (Ubuntu 24.04): installs uv, the Python packages and a
// systemd service that restarts the worker if it stops.
const REMOTE_SETUP = String.raw`
set -euo pipefail
chmod 600 /opt/couchnote/.env
id couchnote >/dev/null 2>&1 || useradd --system --home /opt/couchnote --shell /usr/sbin/nologin couchnote
if [ ! -x /usr/local/bin/uv ]; then curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh; fi
mkdir -p /opt/couchnote/.data/models
chown -R couchnote:couchnote /opt/couchnote
cd /opt/couchnote/services/worker
sudo -u couchnote env UV_CACHE_DIR=/opt/couchnote/.cache/uv UV_PYTHON_INSTALL_DIR=/opt/couchnote/.python /usr/local/bin/uv sync --no-dev --frozen
cat >/etc/systemd/system/couchnote-worker.service <<'UNIT'
[Unit]
Description=CouchNote worker (speech-to-text and AI drafting)
After=network-online.target
Wants=network-online.target

[Service]
User=couchnote
WorkingDirectory=/opt/couchnote/services/worker
Environment=PYTHONUNBUFFERED=1 PYTHONWARNINGS=ignore UV_CACHE_DIR=/opt/couchnote/.cache/uv UV_PYTHON_INSTALL_DIR=/opt/couchnote/.python
ExecStart=/usr/local/bin/uv run --no-dev --frozen python -m worker
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/couchnote

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now couchnote-worker
systemctl restart couchnote-worker
sleep 3
systemctl --no-pager --lines=5 status couchnote-worker || true
`;
