import Link from "next/link";
import { BRAND } from "@taptapsell/brand";
import { apiFetch } from "@/lib/api";

interface PublicPlan {
  code: string;
  name: string;
  description: string | null;
  priceMonthlyPkr: number;
  priceAnnualPkr: number;
  limits: Record<"branches" | "programs" | "stampers" | "staff" | "customers", number | null>;
  features: string[];
}

const LIMITS: Array<[keyof PublicPlan["limits"], string, string]> = [
  ["branches", "branch", "branches"],
  ["stampers", "stamper", "stampers"],
  ["programs", "loyalty program", "loyalty programs"],
  ["staff", "staff login", "staff logins"],
  ["customers", "customer", "customers"],
];

const pkr = (n: number) => `PKR ${n.toLocaleString("en-PK")}`;

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const plans = await apiFetch<PublicPlan[]>("/plans", { anonymous: true }).catch(() => []);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <p className="text-center font-display text-sm font-bold uppercase tracking-[0.18em] text-brand-600">
        Pricing
      </p>
      <h1 className="mt-2 text-center font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl">
        Simple monthly pricing
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-600">
        Every plan starts with a 30-day free trial. Pay yearly and get two months free. Prices
        exclude sales tax.
      </p>

      {plans.length === 0 ? (
        <p className="mt-12 text-center text-ink-500">
          Pricing is being updated. Request access and we will share it with you.
        </p>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className="flex flex-col rounded-[2rem] bg-white p-7 shadow-[0_20px_50px_-30px_rgb(var(--ink-900)/0.35)] ring-1 ring-ink/5"
            >
              <p className="font-display text-xl font-bold text-ink">{plan.name}</p>
              {plan.description ? (
                <p className="mt-1 text-sm text-ink-500">{plan.description}</p>
              ) : null}
              <p className="mt-5 font-display text-4xl font-bold text-ink">
                {pkr(plan.priceMonthlyPkr)}
                <span className="font-sans text-base font-normal text-ink-500"> / month</span>
              </p>
              <p className="text-sm text-ink-500">or {pkr(plan.priceAnnualPkr)} a year</p>
              <ul className="mt-6 flex-1 space-y-2 border-t border-ink/5 pt-5 text-sm text-ink-700">
                {LIMITS.map(([key, one, many]) => {
                  const value = plan.limits[key];
                  return (
                    <li key={key}>
                      {value === null
                        ? `Unlimited ${many}`
                        : `${value.toLocaleString("en-PK")} ${value === 1 ? one : many}`}
                    </li>
                  );
                })}
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={`/business/request-access?plan=${plan.code}`}
                className="mt-7 rounded-full bg-ink py-3.5 text-center font-display font-semibold text-crema transition hover:bg-ink-700"
              >
                Start with {plan.name}
              </Link>
            </div>
          ))}
        </div>
      )}
      <p className="mt-10 text-center text-sm text-ink-500">
        Stampers are supplied by {BRAND.company} and billed once on your first invoice.
      </p>
    </section>
  );
}
