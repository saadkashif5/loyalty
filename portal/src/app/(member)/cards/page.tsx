import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, StampDots } from "@/components/ui";

interface MyCard {
  _id: string;
  stampCount: number;
  status: string;
  businessId: { name: string; category: string } | null;
  programId: { name: string; requiredStamps: number } | null;
}

export default async function CardsPage() {
  const cards = await apiFetch<MyCard[]>("/loyalty-cards");

  if (cards.length === 0) {
    return (
      <Card className="space-y-2 text-center">
        <p className="text-lg font-semibold">No cards yet</p>
        <p className="text-sm text-slate-600">
          Tap a TapTapSell stamper at any participating shop to get your first card.
        </p>
      </Card>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold">My cards</h1>
      {/* One card per shop's program; each is separate. */}
      {cards.map((card) => (
        <Link key={card._id} href={`/cards/${card._id}`} className="block">
          <Card className="space-y-3 transition active:scale-[0.99]">
            <div>
              <p className="font-semibold">{card.businessId?.name ?? "Shop"}</p>
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
