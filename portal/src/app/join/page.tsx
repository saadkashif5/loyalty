import Link from "next/link";
import { Logo } from "@taptapsell/brand/logo";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getPendingTap } from "@/lib/session";
import { collectStampAction, joinProgramAction } from "@/app/actions";
import { Button, Card, ErrorText, Notice } from "@/components/ui";
import { EmailSignIn } from "@/components/EmailSignIn";

interface PublicBusiness {
  business: { _id: string; name: string; description?: string; category: string };
  programs: Array<{
    _id: string;
    name: string;
    description?: string;
    requiredStamps: number;
    terms?: string;
    rewards: Array<{ _id: string; name: string }>;
  }>;
}

interface MyCard {
  _id: string;
  status: string;
  programId: { _id: string } | null;
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const tap = await getPendingTap();

  if (!tap) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-5">
        <Card className="space-y-2 text-center">
          <p className="font-display text-xl font-bold">Tap the stamper to start</p>
          <p className="text-sm text-ink-600">
            Your tap has expired. Hold your phone to the stamper at the counter again.
          </p>
        </Card>
        <Link href="/cards" className="text-center text-sm text-ink-500">
          Go to my cards
        </Link>
      </main>
    );
  }

  const { business, programs } = await apiFetch<PublicBusiness>(
    `/discover/businesses/${tap.businessId}`,
    { anonymous: true },
  );
  const signedIn = Boolean(await getAccessToken());
  const cards = signedIn ? await apiFetch<MyCard[]>("/loyalty-cards").catch(() => []) : [];
  const memberCard = cards.find(
    (c) => c.status === "ACTIVE" && c.programId && tap.programIds.includes(c.programId._id),
  );

  return (
    <main className="mx-auto max-w-md space-y-5 p-5">
      <div className="pt-4 text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="sm" />
        </div>
        <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-brand-600">
          Welcome to
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{business.name}</h1>
        {business.description ? (
          <p className="mt-1 text-sm text-ink-600">{business.description}</p>
        ) : null}
      </div>

      {programs.map((program) => (
        <Card key={program._id} className="space-y-2">
          <p className="font-display text-lg font-bold">{program.name}</p>
          <p className="text-sm text-ink-600">
            Collect {program.requiredStamps} stamps
            {program.rewards.length > 0
              ? ` and earn: ${program.rewards.map((r) => r.name).join(", ")}`
              : ""}
            .
          </p>
          {program.terms ? <p className="text-xs text-ink-500">{program.terms}</p> : null}
        </Card>
      ))}

      <ErrorText>{error}</ErrorText>

      {!signedIn ? (
        <Card className="space-y-3">
          <p className="font-semibold">Join with your email</p>
          <EmailSignIn next="/join" />
        </Card>
      ) : memberCard ? (
        <Card className="space-y-3">
          <Notice tone="success">
            You are already a member. Collect the stamp for this visit:
          </Notice>
          <form action={collectStampAction.bind(null, memberCard._id)}>
            <Button type="submit">Collect my stamp</Button>
          </form>
        </Card>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => (
            <form key={program._id} action={joinProgramAction.bind(null, program._id)}>
              <Button type="submit">Join {program.name}</Button>
            </form>
          ))}
          <p className="text-center text-xs text-ink-500">
            After joining, tap the stamper again to collect your first stamp.
          </p>
        </div>
      )}
    </main>
  );
}
