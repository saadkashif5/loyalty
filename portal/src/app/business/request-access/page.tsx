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
    <section className="mx-auto max-w-xl px-5 py-14">
      <h1 className="text-3xl font-bold">Request access</h1>
      <p className="mt-2 text-slate-600">
        {BRAND.name} is opening city by city. Tell us about your business and we will call you
        within two working days.
      </p>
      <div className="mt-8">
        <RequestAccessForm plan={plan?.slice(0, 31)} />
      </div>
    </section>
  );
}
