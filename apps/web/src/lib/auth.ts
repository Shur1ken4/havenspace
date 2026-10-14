import "server-only";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { pool } from "./db";
import { sendEmail } from "./email";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const sessionHours = Number(process.env.SESSION_HOURS ?? 12);

export const auth = betterAuth({
  appName: "Psych Copilot",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  trustedOrigins: [appUrl],
  session: {
    expiresIn: sessionHours * 60 * 60,
    updateAge: 60 * 60,
    // Exports and deletions need a sign-in from the last 15 minutes.
    freshAge: 15 * 60,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
  },
  advanced: { useSecureCookies: appUrl.startsWith("https://") },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      async sendMagicLink({ email, url }) {
        await sendEmail({
          to: email,
          subject: "Your sign-in link",
          text: `Here is your sign-in link. It works once and expires in 15 minutes.\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
        });
      },
    }),
    passkey({ rpName: "Psych Copilot", rpID: new URL(appUrl).hostname, origin: appUrl }),
    twoFactor({ issuer: "Psych Copilot", allowPasswordless: true }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
