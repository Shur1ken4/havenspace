import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession, loadRole, loadTherapist, realDataAllowed } from "@/lib/session";
import { ARCH_TOOLS, runTool } from "@/lib/arch/tools";
import { archSystemPrompt } from "@/lib/arch/prompt";

// "Ask Arch" (ADR-19): one conversation turn, streamed back as lines of JSON:
// {type:"text"} pieces of the answer, {type:"tool"} what Arch is looking at,
// {type:"proposal"} an action waiting for the therapist's approval, {type:"done"}.
// Conversations are not stored; the audit log records only that Arch was asked.

export const maxDuration = 60;
const MODEL = process.env.ARCH_MODEL ?? "claude-sonnet-5-5";
const DAILY_LIMIT = Number(process.env.ARCH_DAILY_LIMIT ?? 150);
const MAX_TOOL_ROUNDS = 6;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30),
  clientId: z.uuid().optional(),
  timeZone: z.string().max(60).optional(),
});

const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return json({ error: "unauthorised" }, 401);
  if ((await loadRole(session.user.id)) !== "therapist") return json({ error: "forbidden" }, 403);
  const therapist = await loadTherapist(session.user.id, session.user.email);
  if (therapist.access_status !== "approved") return json({ error: "pending" }, 403);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);
  // Real client data needs Claude in the EU (ADR-3); the direct API is for role-play only.
  if (realDataAllowed()) return json({ error: "not_configured" }, 503);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return json({ error: "bad_request" }, 400);
  const { messages, clientId } = parsed.data;
  const timeZone = parsed.data.timeZone && Intl.supportedValuesOf("timeZone").includes(parsed.data.timeZone) ? parsed.data.timeZone : "Europe/Dublin";

  const context = await withUser(therapist.id, async (db) => {
    const used = (await db.query(
      "select count(*)::int as n from audit_log where therapist_id = $1 and action = 'arch.ask' and at > now() - interval '24 hours'", [therapist.id])).rows[0].n;
    if (used >= DAILY_LIMIT) return null;
    await audit(db, therapist.id, "arch.ask", "arch", null);
    return clientId ? (await db.query("select pseudonym from clients where id = $1", [clientId])).rows[0]?.pseudonym as string | undefined : undefined;
  });
  if (context === null) return json({ error: "limit" }, 429);

  const system = archSystemPrompt({
    language: therapist.language, therapistName: therapist.full_name || therapist.display_name,
    today: new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone }).format(new Date()), timeZone, clientContext: context,
  });
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const client = new Anthropic();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(enc.encode(`${JSON.stringify(event)}\n`));
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (round > 0) send({ type: "break" });
          const turn = client.messages.stream({ model: MODEL, max_tokens: 2048, system, tools: ARCH_TOOLS, messages: convo });
          turn.on("text", (text) => send({ type: "text", text }));
          const msg = await turn.finalMessage();
          convo.push({ role: "assistant", content: msg.content });
          if (msg.stop_reason === "refusal") { send({ type: "error", error: "refusal" }); break; }
          if (msg.stop_reason !== "tool_use") break;
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of msg.content) {
            if (block.type !== "tool_use") continue;
            send({ type: "tool", name: block.name });
            const result = await withUser(therapist.id, (db) => runTool(db, block.name, (block.input ?? {}) as Record<string, unknown>))
              .catch(() => ({ text: "That lookup failed; tell the therapist you couldn't check this.", proposal: undefined }));
            if (result.proposal) send({ type: "proposal", proposal: result.proposal });
            results.push({ type: "tool_result", tool_use_id: block.id, content: result.text });
          }
          convo.push({ role: "user", content: results });
        }
        send({ type: "done" });
      } catch {
        // Never forward provider errors: they could echo session content.
        send({ type: "error", error: "failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
