import "server-only";
import type { Db } from "./db";

// Records who did what, when. Never pass content (names, text) here.
export async function audit(db: Db, userId: string, action: string, entityType: string, entityId?: string | null) {
  await db.query(
    "insert into audit_log (therapist_id, actor, action, entity_type, entity_id) values ($1, $1, $2, $3, $4)",
    [userId, action, entityType, entityId ?? null],
  );
}
