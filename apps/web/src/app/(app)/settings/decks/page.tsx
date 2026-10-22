import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { loadMyDecks, MAX_CARDS, MAX_DECKS } from "@/lib/decks-server";
import { DECKS, deckRefs } from "@/lib/tools/decks";
import { Card } from "@/components/ui/card";
import { CardFace } from "@/components/cards/card-face";
import { MyDeckCard, NewDeckForm } from "./parts";

export async function generateMetadata() {
  return { title: (await getTranslations("decks"))("title") };
}

/** Settings → Card decks: our decks (to browse) and the therapist's own (to upload and manage). */
export default async function DecksPage() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("decks");
  const mine = await withUser(therapist.id, loadMyDecks);

  return (
    <div className="space-y-10">
      <section aria-labelledby="ours" className="space-y-4">
        <div className="space-y-1">
          <h2 id="ours" className="text-2xl">{t("oursTitle")}</h2>
          <p className="text-muted">{t("oursBody")}</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {DECKS.map((d) => {
            const refs = deckRefs(d.id);
            return (
              <li key={d.id}>
                <Card className="space-y-3 p-5">
                  <div className="flex gap-4">
                    <CardFace refId={`${d.id}/${d.cover}`} fit="cover" className="w-24 shrink-0 shadow-soft" />
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-serif text-xl text-ink">{t(`name_${d.id}`)}</h3>
                      <p className="text-sm text-muted">{t("count", { count: d.count })}</p>
                      <p className="text-sm text-ink">{t(`about_${d.id}`)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">{t(`credit_${d.id}`)}</p>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-primary-strong">{t("seeAll")}</summary>
                    <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {refs.map((r) => <li key={r}><CardFace refId={r} fit="cover" /></li>)}
                    </ul>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="mine" className="space-y-4">
        <div className="space-y-1">
          <h2 id="mine" className="text-2xl">{t("mineTitle")}</h2>
          <p className="text-muted">{t("mineBody", { cards: MAX_CARDS })}</p>
        </div>
        {mine.length > 0 && (
          <ul className="space-y-4">
            {mine.map((d) => <li key={d.id}><MyDeckCard deck={{ id: d.id, name: d.name, refs: d.refs }} max={MAX_CARDS} /></li>)}
          </ul>
        )}
        {mine.length < MAX_DECKS ? <NewDeckForm first={mine.length === 0} /> : <p className="text-sm text-muted">{t("tooMany", { max: MAX_DECKS })}</p>}
      </section>
    </div>
  );
}
