import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { Card } from "@/components/ui";

export default async function HomePage() {
  if (await getAccessToken()) redirect("/cards");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-5">
      <div className="text-center">
        <p className="text-3xl font-bold text-brand-600">TapTapSell</p>
        <p className="mt-2 text-slate-600">Collect stamps at your favourite shops. Earn rewards.</p>
      </div>
      <Card className="space-y-3 text-center">
        <p className="text-lg font-semibold">Tap to start</p>
        <p className="text-sm text-slate-600">
          Hold your phone near the TapTapSell stamper at the counter after you pay. Your card opens
          here — no app to install.
        </p>
      </Card>
      <Link
        href="/signin"
        className="block rounded-xl border border-slate-300 bg-white py-3 text-center font-medium"
      >
        Already a member? Sign in
      </Link>
    </main>
  );
}
