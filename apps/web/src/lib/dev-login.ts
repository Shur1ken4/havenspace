import "server-only";

/** Local development only: emails are kept in memory instead of being sent.
 *  Never true on a production build, and sendEmail refuses "console" there too. */
export function devLoginEnabled() {
  return process.env.NODE_ENV !== "production" && (process.env.EMAIL_TRANSPORT ?? "console") === "console";
}
