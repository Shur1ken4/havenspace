import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { realDataAllowed, requireTherapist } from "@/lib/session";
import { AskArch } from "@/components/arch/ask-arch";

export async function generateMetadata() {
  return { title: (await getTranslations("askArch"))("title") };
}

export default async function ArchPage({ searchParams }: PageProps<"/arch">) {
  const { therapist } = await requireTherapist();
  const sp = await searchParams;
  const clients = await withUser(therapist.id, async (db) =>
    (await db.query("select id, pseudonym from clients where status = 'active' order by pseudonym")).rows as { id: string; pseudonym: string }[]);
  const initialClientId = typeof sp.client === "string" && clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  // Claude direct is for role-play only; real client data waits for Claude in the EU (ADR-3).
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY) && !realDataAllowed();
  return <AskArch clients={clients} initialClientId={initialClientId} brief={sp.brief === "1"} enabled={enabled} />;
}
