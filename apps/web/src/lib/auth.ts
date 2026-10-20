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

/** Email language: the language chosen on the site, else the browser's. */
function emailLocale(request?: Request | null): "en" | "ru" {
  const cookie = request?.headers.get("cookie") ?? "";
  const chosen = /(?:^|;\s*)locale=(en|ru)(?:;|$)/.exec(cookie)?.[1] as "en" | "ru" | undefined;
  const browser = (request?.headers.get("accept-language") ?? "").trim().toLowerCase().startsWith("ru") ? "ru" : "en";
  return chosen ?? browser;
}
const sessionHours = Number(process.env.SESSION_HOURS ?? 12);

export const auth = betterAuth({
  appName: "HavenSpace",
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
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/email-otp/verify-email": { window: 60, max: 10 },
      "/email-otp/reset-password": { window: 60, max: 5 },
    },
  },
  // Accounts are created with email + password (ADR-18). The address is proved
  // by a 6-digit code before the first sign-in; a forgotten password is reset
  // with an email code, and the code sign-in stays as a fallback.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    // Signing up with an address that already has an account looks the same as a
    // new sign-up on screen, so nobody can find out who uses HavenSpace (and so,
    // who may be in therapy). The owner gets an email explaining what to do.
    async onExistingUserSignUp({ user }, request) {
      const t = await getTranslations({ locale: emailLocale(request), namespace: "authEmail" });
      await sendEmail({ to: user.email, subject: t("existsSubject"), text: t("existsBody", { url: `${appUrl}/login` }) });
    },
  },
  emailVerification: { autoSignInAfterVerification: true },
  advanced: { useSecureCookies: appUrl.startsWith("https://") },
  plugins: [
    // 6-digit codes by email: confirming a new address, resetting a password,
    // and signing in without a password. Unlike a one-time link, a code isn't
    // used up by email security scanners (common on work email), and it works
    // when the email is opened on a different device. Codes never create
    // accounts (that's the sign-up form's job); pilot access is approved
    // separately (ADR-11).
    emailOTP({
      disableSignUp: true,
      sendVerificationOnSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }, ctx) {
        const t = await getTranslations({ locale: emailLocale(ctx?.request), namespace: "authEmail" });
        // Same code, worded for what the person is doing.
        const kind = type === "email-verification" ? "verify" : type === "forget-password" ? "reset" : "signin";
        await sendEmail({ to: email, subject: t(`${kind}Subject`, { code: otp }), text: t(`${kind}Body`, { code: otp }) });
      },
    }),
    passkey({ rpName: "HavenSpace", rpID: new URL(appUrl).hostname, origin: appUrl }),
    twoFactor({ issuer: "HavenSpace", allowPasswordless: true }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
