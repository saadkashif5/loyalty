import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, StampDots } from "@/components/ui";
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
        <Card className="space-y-2 text-center">
          <p className="text-lg font-semibold">{t("cards.emptyTitle")}</p>
          <p className="text-sm text-slate-600">{t("cards.emptyBody")}</p>
        </Card>
        {nfc}
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold">{t("cards.title")}</h1>
      {nfc}
      {/* One card per shop's program; each is separate. */}
      {cards.map((card) => (
        <Link key={card._id} href={`/cards/${card._id}`} className="block">
          <Card className="space-y-3 transition active:scale-[0.99]">
            <div>
              <p className="font-semibold">{card.businessId?.name ?? t("cards.shop")}</p>
              <p className="text-sm text-slate-500">{card.programId?.name}</p>
            </div>
            {card.programId ? (
              <StampDots count={card.stampCount} required={card.programId.requiredStamps} />
            ) : null}
          </Card>
        </Link>
      ))}
    </>
  );
}
