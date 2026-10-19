import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isMfaPending } from "@/lib/mfa";

const handler = toNextJsHandler(auth);

// While two-step verification is pending, only these sign-in endpoints work.
// Everything else (e.g. turning 2FA off, adding a passkey) needs the code first.
const ALLOWED_WHILE_PENDING = new Set([
  "/get-session", "/sign-out", "/email-otp/send-verification-otp", "/sign-in/email-otp",
  "/passkey/generate-authenticate-options", "/passkey/verify-authentication",
]);

async function guard(req: Request, next: (req: Request) => Promise<Response>) {
  const path = new URL(req.url).pathname.replace(/^\/api\/auth/, "");
  if (!ALLOWED_WHILE_PENDING.has(path)) {
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
    if (session && (await isMfaPending(session))) {
      return Response.json({ code: "TWO_FACTOR_REQUIRED", message: "Two-step verification required" }, { status: 403 });
    }
  }
  return next(req);
}

export const GET = (req: Request) => guard(req, handler.GET);
export const POST = (req: Request) => guard(req, handler.POST);
