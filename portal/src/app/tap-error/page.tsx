import Link from "next/link";
import { Card } from "@/components/ui";

// What a customer sees when a tap cannot be used. Plain language: they are
// standing at a counter, often with a queue behind them.
const MESSAGES: Record<string, { title: string; text: string }> = {
  TAP_REPLAYED: {
    title: "Tap the stamper again",
    text: "This link was already used. Each tap works once — hold your phone to the stamper once more.",
  },
  INVALID_TAP: {
    title: "We could not read that tap",
    text: "Hold your phone still against the stamper for a moment and try again.",
  },
  NOT_FOUND: {
    title: "Stamper not recognised",
    text: "This stamper is not set up yet. Please let the staff know.",
  },
  BAD_REQUEST: {
    title: "This stamper is not active",
    text: "The shop may be closed or the stamper switched off. Please ask the staff.",
  },
  RATE_LIMITED: {
    title: "Too many taps",
    text: "Please wait a minute, then tap again.",
  },
};

const FALLBACK = {
  title: "Something went wrong",
  text: "Please tap the stamper again. If it keeps happening, let the staff know.",
};

export default async function TapErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || FALLBACK;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-5">
      <Card className="space-y-2 text-center">
        <p className="text-4xl" aria-hidden>
          📱
        </p>
        <p className="text-lg font-semibold">{message.title}</p>
        <p className="text-sm text-slate-600">{message.text}</p>
      </Card>
      <Link href="/cards" className="text-center text-sm text-slate-500">
        Go to my cards
      </Link>
    </main>
  );
}
