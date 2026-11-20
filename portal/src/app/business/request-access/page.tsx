import { BRAND } from "@taptapsell/brand";
import { RequestAccessForm } from "./RequestAccessForm";

export const metadata = { title: "Request access" };

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return (
    <section className="mx-auto max-w-xl px-5 py-16 sm:py-20">
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        Request access
      </h1>
      <p className="mt-4 text-lg text-ink-600">
        {BRAND.name} is opening city by city. Tell us about your business and we will call you
        within two working days.
      </p>
      <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_-30px_rgb(var(--ink-900)/0.35)] ring-1 ring-ink/5 sm:p-8">
        <RequestAccessForm plan={plan?.slice(0, 31)} />
      </div>
    </section>
  );
}
