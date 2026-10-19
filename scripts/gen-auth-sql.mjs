// Prints the SQL for Better Auth's tables (user, session, account, ...).
// Used once to create db/migrations/0001_auth.sql; re-run when auth plugins change.
import { getMigrations } from "better-auth/db/migration";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL.replace(/\/psych$/, "/psych_test") });
const { compileMigrations } = await getMigrations({
  database: pool,
  rateLimit: { enabled: true, storage: "database" },
  plugins: [emailOTP({ async sendVerificationOTP() {} }), passkey(), twoFactor({ allowPasswordless: true })],
});
console.log(await compileMigrations());
await pool.end();
