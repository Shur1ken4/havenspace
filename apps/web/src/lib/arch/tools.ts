import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/db";

// Arch's abilities (ADR-19). Every query runs inside withUser(), so row-level
// security limits Arch to the signed-in therapist's own data: it cannot see
// another therapist's clients even if asked to. Actions are only *proposed*;
// the therapist approves each one on screen.

export type Proposal =
  | { kind: "homework"; clientId: string; client: string; title: string; details: string; dueOn: string | null }
  | { kind: "next_session"; clientId: string; client: string; startsAt: string };

type ToolResult = { text: string; proposal?: Proposal };

const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const momentLink = (sessionId: string, idx: number, date: string, ms: number) => `[${date} · ${clock(ms)}](/sessions/${sessionId}?moment=${idx})`;
const sessionLink = (sessionId: string, date: string) => `[${date}](/sessions/${sessionId})`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export const ARCH_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_clients",
    description: "List the therapist's active clients (pseudonyms only) with last session date, number of sessions, whether consent is on file, whether they use the client app, and the next booked session. Use this to find a client or answer questions about the caseload.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "client_overview",
    description: "Everything the therapist has on one client: recent sessions (with links), themes and goals from the timeline, homework and whether it was done, mood-diary entries the client chose to share, and the next booked session. Use for 'brief me' and questions about a client.",
    input_schema: {
      type: "object",
      properties: { client: { type: "string", description: "The client's pseudonym (e.g. 'Client A') or id." } },
      required: ["client"], additionalProperties: false,
    },
  },
  {
    name: "search_sessions",
    description: "Search the words said in the therapist's session transcripts. Returns matching moments with links to the exact place. Use it to answer 'what did X say about Y' questions; search with a few short keywords, and try synonyms if nothing comes back.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A few keywords, e.g. 'sleep insomnia tired'." },
        client: { type: "string", description: "Optional pseudonym or id to search only one client." },
      },
      required: ["query"], additionalProperties: false,
    },
  },
  {
    name: "get_session",
    description: "One session in full: date, client, length, the note (draft or approved), the reflection on the therapist's technique, and the transcript. Use when the therapist asks about a specific session.",
    input_schema: {
      type: "object",
      properties: { session_id: { type: "string", description: "The session id (from another tool's links)." } },
      required: ["session_id"], additionalProperties: false,
    },
  },
  {
    name: "practice_summary",
    description: "Practice numbers for a month: sessions held, client hours, sessions per client, notes still waiting for approval. Use for workload and supervision-hours questions.",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM. Defaults to the current month." } },
      additionalProperties: false,
    },
  },
  {
    name: "propose_homework",
    description: "Propose a piece of homework for a client. Nothing is saved until the therapist presses Approve on screen. Only use when the therapist asks for it.",
    input_schema: {
      type: "object",
      properties: {
        client: { type: "string" },
        title: { type: "string", description: "Short, plain title (max 120 characters)." },
        details: { type: "string", description: "Optional details for the client (max 600 characters)." },
        due_on: { type: "string", description: "Optional due date, YYYY-MM-DD." },
      },
      required: ["client", "title"], additionalProperties: false,
    },
  },
  {
    name: "propose_next_session",
    description: "Propose booking the client's next session. Nothing is saved until the therapist presses Approve. Only use when the therapist asks for it.",
    input_schema: {
      type: "object",
      properties: {
        client: { type: "string" },
        starts_at: { type: "string", description: "Date and time with the therapist's UTC offset, e.g. 2026-10-27T10:00:00+00:00." },
      },
      required: ["client", "starts_at"], additionalProperties: false,
    },
  },
];

async function findClient(db: Db, ref: unknown): Promise<{ id: string; pseudonym: string } | null> {
  const s = String(ref ?? "").trim();
  if (!s) return null;
  const { rows } = await db.query(
    `select id, pseudonym from clients
      where status = 'active' and (id::text = $1 or lower(pseudonym) = lower($1) or lower(pseudonym) like lower($1) || '%')
      order by (lower(pseudonym) = lower($1)) desc limit 1`, [s]);
  return rows[0] ?? null;
}

export async function runTool(db: Db, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_clients": {
      const { rows } = await db.query(`
        select c.pseudonym,
               (select max(started_at) from sessions s where s.client_id = c.id and s.status <> 'draft') as last_session,
               (select count(*)::int from sessions s where s.client_id = c.id and s.status <> 'draft') as sessions,
               exists (select 1 from consents k where k.client_id = c.id and k.withdrawn_at is null) as consent,
               exists (select 1 from client_accounts a where a.client_id = c.id and a.revoked_at is null) as client_app,
               (select min(starts_at) from appointments a where a.client_id = c.id and a.starts_at > now()) as next_session
          from clients c where c.status = 'active' order by c.pseudonym`);
      if (!rows.length) return { text: "No active clients yet." };
      return { text: rows.map((r) => `- ${r.pseudonym}: ${r.sessions} sessions, last ${r.last_session ? day(r.last_session) : "never"}, consent ${r.consent ? "on file" : "MISSING"}, client app ${r.client_app ? "yes" : "no"}, next session ${r.next_session ? new Date(r.next_session).toISOString() : "not booked"}`).join("\n") };
    }

    case "client_overview": {
      const c = await findClient(db, input.client);
      if (!c) return { text: `No client called "${input.client}".` };
      const sessions = (await db.query(
        `select s.id, s.started_at, s.capture_mode, s.duration_seconds, s.status, n.status as note_status
           from sessions s left join notes n on n.session_id = s.id
          where s.client_id = $1 and s.status <> 'draft' order by s.started_at desc limit 6`, [c.id])).rows;
      const timeline = (await db.query(
        "select kind, text, status from client_timeline_items where client_id = $1 and status <> 'dropped' order by status, updated_at desc limit 20", [c.id])).rows;
      const homework = (await db.query(
        "select title, due_on, done_at, client_reply from assignments where client_id = $1 and archived_at is null order by created_at desc limit 10", [c.id])).rows;
      const moods = (await db.query(
        "select mood, note, created_at from mood_entries where client_id = $1 and shared order by created_at desc limit 6", [c.id])).rows;
      const next = (await db.query("select min(starts_at) as s from appointments where client_id = $1 and starts_at > now()", [c.id])).rows[0]?.s;
      const lastNote = sessions[0] ? (await db.query("select content_json from notes where session_id = $1", [sessions[0].id])).rows[0]?.content_json : null;
      const lines = [
        `Client: ${c.pseudonym} (id ${c.id})`,
        `Next session: ${next ? new Date(next).toISOString() : "not booked"}`,
        "Recent sessions:",
        ...(sessions.length ? sessions.map((s) => `- ${sessionLink(s.id, day(s.started_at))} ${s.capture_mode}, ${Math.round((s.duration_seconds ?? 0) / 60)} min, ${s.status}, note ${s.note_status ?? "none"}`) : ["- none yet"]),
        lastNote ? `Latest note (${lastNote.format}): ${clip((lastNote.sections ?? []).map((x: { key: string; text: string }) => `${x.key}: ${x.text}`).join(" | "), 1500)}` : "",
        "Timeline (themes, goals, homework, changes):",
        ...(timeline.length ? timeline.map((i) => `- [${i.kind}${i.status === "done" ? ", done" : ""}] ${i.text}`) : ["- nothing yet"]),
        "Homework set in the client app:",
        ...(homework.length ? homework.map((h) => `- ${h.title}${h.due_on ? ` (due ${day(h.due_on)})` : ""}: ${h.done_at ? "done" : "not done"}${h.client_reply ? `; client's reply: "${clip(h.client_reply, 200)}"` : ""}`) : ["- none"]),
        "Mood-diary entries the client shared (1 very low – 5 very good):",
        ...(moods.length ? moods.map((m) => `- ${day(m.created_at)}: ${m.mood}/5${m.note ? ` "${clip(m.note, 200)}"` : ""}`) : ["- none shared"]),
      ];
      return { text: lines.filter(Boolean).join("\n") };
    }

    case "search_sessions": {
      const q = String(input.query ?? "").trim().slice(0, 200);
      if (!q) return { text: "Empty search." };
      const c = input.client ? await findClient(db, input.client) : null;
      if (input.client && !c) return { text: `No client called "${input.client}".` };
      const words = q.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
      const { rows } = await db.query(
        `select t.session_id, t.idx, t.speaker, t.start_ms, t.text, s.started_at, c.pseudonym
           from transcript_segments t join sessions s on s.id = t.session_id join clients c on c.id = s.client_id
          where ($1::uuid is null or s.client_id = $1)
            and (to_tsvector('simple', t.text) @@ plainto_tsquery('simple', $2) or t.text ilike any ($3::text[]))
          order by s.started_at desc, t.idx limit 14`,
        [c?.id ?? null, q, words.map((w) => `%${w}%`)]);
      if (!rows.length) return { text: `Nothing found for "${q}"${c ? ` with ${c.pseudonym}` : ""}. Try other words.` };
      return { text: rows.map((r) => `- ${r.pseudonym}, ${momentLink(r.session_id, r.idx, day(r.started_at), r.start_ms)} — ${r.speaker}: "${clip(r.text, 280)}"`).join("\n") };
    }

    case "get_session": {
      const id = String(input.session_id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return { text: "That isn't a session id." };
      const s = (await db.query(
        `select s.id, s.started_at, s.capture_mode, s.duration_seconds, s.status, c.pseudonym
           from sessions s join clients c on c.id = s.client_id where s.id = $1`, [id])).rows[0];
      if (!s) return { text: "Session not found." };
      const note = (await db.query("select status, content_json from notes where session_id = $1", [id])).rows[0];
      const refl = (await db.query("select content_json from reflections where session_id = $1", [id])).rows[0]?.content_json;
      const segs = (await db.query("select idx, speaker, start_ms, text from transcript_segments where session_id = $1 order by idx limit 400", [id])).rows;
      const date = day(s.started_at);
      const item = (x: { text: string; segment_ids?: number[] }) => {
        const seg = segs.find((g) => g.idx === x.segment_ids?.[0]);
        return `${x.text}${seg ? ` (${momentLink(id, seg.idx, date, seg.start_ms)})` : ""}`;
      };
      return {
        text: [
          `Session ${sessionLink(id, date)} with ${s.pseudonym}: ${s.capture_mode}, ${Math.round((s.duration_seconds ?? 0) / 60)} min, ${s.status}.`,
          note ? `Note (${note.status}): ${(note.content_json.sections ?? []).map((x: { key: string; text: string }) => `${x.key}: ${x.text}`).join("\n")}` : "No note yet.",
          refl ? `Reflection — strengths: ${(refl.strengths ?? []).map(item).join("; ")}\nOpenings: ${(refl.missed_openings ?? []).map(item).join("; ")}\nTo try: ${(refl.try_next ?? []).map(item).join("; ")}` : "",
          "Transcript:",
          ...segs.map((g) => `[${g.idx} · ${clock(g.start_ms)}] ${g.speaker}: ${g.text}`),
        ].filter(Boolean).join("\n"),
      };
    }

    case "practice_summary": {
      const month = /^\d{4}-\d{2}$/.test(String(input.month ?? "")) ? String(input.month) : new Date().toISOString().slice(0, 7);
      const { rows } = await db.query(
        `select c.pseudonym, count(*)::int as sessions, coalesce(sum(s.duration_seconds), 0)::int as seconds
           from sessions s join clients c on c.id = s.client_id
          where s.status <> 'draft' and to_char(s.started_at, 'YYYY-MM') = $1 group by c.pseudonym order by c.pseudonym`, [month]);
      const waiting = (await db.query("select count(*)::int as n from notes where status = 'draft'")).rows[0].n;
      const total = rows.reduce((a, r) => a + r.seconds, 0);
      return {
        text: [`Month ${month}: ${rows.reduce((a, r) => a + r.sessions, 0)} sessions, ${(total / 3600).toFixed(1)} client hours.`,
          ...rows.map((r) => `- ${r.pseudonym}: ${r.sessions} sessions, ${(r.seconds / 3600).toFixed(1)} h`),
          `Notes waiting for approval (all months): ${waiting}.`].join("\n"),
      };
    }

    case "propose_homework": {
      const c = await findClient(db, input.client);
      if (!c) return { text: `No client called "${input.client}".` };
      const title = String(input.title ?? "").trim().slice(0, 120);
      if (!title) return { text: "Homework needs a title." };
      const due = /^\d{4}-\d{2}-\d{2}$/.test(String(input.due_on ?? "")) ? String(input.due_on) : null;
      return {
        text: `Proposal shown to the therapist with an Approve button (not saved yet): homework "${title}" for ${c.pseudonym}${due ? `, due ${due}` : ""}.`,
        proposal: { kind: "homework", clientId: c.id, client: c.pseudonym, title, details: String(input.details ?? "").slice(0, 600), dueOn: due },
      };
    }

    case "propose_next_session": {
      const c = await findClient(db, input.client);
      if (!c) return { text: `No client called "${input.client}".` };
      const when = new Date(String(input.starts_at ?? ""));
      if (Number.isNaN(when.getTime())) return { text: "That date and time couldn't be read; ask the therapist to say it again." };
      if (when.getTime() < Date.now()) return { text: "That time is in the past." };
      return {
        text: `Proposal shown to the therapist with an Approve button (not saved yet): next session for ${c.pseudonym} at ${when.toISOString()}.`,
        proposal: { kind: "next_session", clientId: c.id, client: c.pseudonym, startsAt: when.toISOString() },
      };
    }
  }
  return { text: `Unknown tool ${name}.` };
}
