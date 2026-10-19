import "server-only";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import { getTranslations } from "next-intl/server";
import { twoFactor } from "better-auth/plugins/two-factor";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { pool } from "./db";
import { sendEmail } from "./email";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const sessionHours = Number(process.env.SESSION_HOURS ?? 12);

export const auth = betterAuth({
  appName: "CouchNote",
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
    // Per visitor IP. Sending codes is the expensive, abusable step (it sends
    // email); checking a code is also capped by allowedAttempts below.
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  advanced: { useSecureCookies: appUrl.startsWith("https://") },
  plugins: [
    // Sign-in by a 6-digit code sent by email. Unlike a one-time link, a code
    // isn't used up by email security scanners (common on work email), and it
    // works when the email is opened on a different device. New emails create
    // an account; pilot access is approved separately (ADR-11).
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }, ctx) {
        const cookie = ctx?.request?.headers.get("cookie") ?? "";
        const chosen = /(?:^|;\s*)locale=(en|ru)(?:;|$)/.exec(cookie)?.[1];
        const browser = (ctx?.request?.headers.get("accept-language") ?? "").trim().toLowerCase().startsWith("ru") ? "ru" : "en";
        const locale = chosen ?? browser;
        const t = await getTranslations({ locale, namespace: "authEmail" });
        await sendEmail({ to: email, subject: t("subject", { code: otp }), text: t("body", { code: otp }) });
      },
    }),
    passkey({ rpName: "CouchNote", rpID: new URL(appUrl).hostname, origin: appUrl }),
    twoFactor({ issuer: "CouchNote", allowPasswordless: true }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
