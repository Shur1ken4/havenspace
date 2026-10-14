"use server";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function sendFeedback(input: { page: string; rating: number | null; message: string }) {
  const session = await requireUser();
  const rating = input.rating && input.rating >= 1 && input.rating <= 5 ? input.rating : null;
  await withUser(session.user.id, (db) =>
    db.query("insert into feedback (therapist_id, page, rating, message) values ($1, $2, $3, $4)", [
      session.user.id, input.page.slice(0, 200), rating, input.message.slice(0, 2000),
    ]),
  );
}
