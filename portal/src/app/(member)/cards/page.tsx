import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, ScreenTitle, StampCardFace } from "@/components/ui";
import { Flower } from "@/components/landing/icons";
import { WebNfcTap } from "@/components/WebNfcTap";
import { getT, pick } from "@/lib/i18n";

interface MyCard {
  _id: string;
  stampCount: number;
  status: string;
  businessId: { name: string; category: string } | null;
  programId: { name: string; requiredStamps: number } | null;
}

export default async function CardsPage() {
  const [cards, t] = await Promise.all([apiFetch<MyCard[]>("/loyalty-cards"), getT()]);
  const nfc = (
    <WebNfcTap
      messages={pick(t, ["nfc.button", "nfc.listening", "nfc.notOurs", "nfc.readError", "nfc.off"])}
    />
  );

  if (cards.length === 0) {
    return (
      <>
        <Card className="space-y-2 py-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Flower className="h-8 w-8" />
          </span>
          <p className="pt-2 font-display text-xl font-bold">{t("cards.emptyTitle")}</p>
          <p className="text-sm text-ink-600">{t("cards.emptyBody")}</p>
        </Card>
        {nfc}
      </>
    );
  }

  return (
    <>
      <ScreenTitle>{t("cards.title")}</ScreenTitle>
      {nfc}
      {/* One card per shop's program; each is separate. */}
      {cards.map((card) => (
        <Link
          key={card._id}
          href={`/cards/${card._id}`}
          className="block rounded-[1.75rem] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        >
          <StampCardFace
            shop={card.businessId?.name ?? t("cards.shop")}
            program={card.programId?.name}
            count={card.stampCount}
            required={card.programId?.requiredStamps ?? 0}
          />
        </Link>
      ))}
    </>
  );
}
