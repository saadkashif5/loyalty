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
    <section className="mx-auto max-w-5xl px-5 py-14">
      <h1 className="text-center text-3xl font-bold">Simple monthly pricing</h1>
      <p className="mt-2 text-center text-slate-600">
        Every plan starts with a 30-day free trial. Pay yearly and get two months free. Prices
        exclude sales tax.
      </p>

      {plans.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">
          Pricing is being updated. Request access and we will share it with you.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.code} className="flex flex-col rounded-2xl border border-slate-200 p-6">
              <p className="text-lg font-semibold">{plan.name}</p>
              {plan.description ? (
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              ) : null}
              <p className="mt-4 text-3xl font-bold">
                {pkr(plan.priceMonthlyPkr)}
                <span className="text-base font-normal text-slate-500"> / month</span>
              </p>
              <p className="text-sm text-slate-500">or {pkr(plan.priceAnnualPkr)} a year</p>
              <ul className="mt-5 flex-1 space-y-1.5 text-sm">
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
                className="mt-6 rounded-xl bg-brand-600 py-3 text-center font-medium text-white"
              >
                Start with {plan.name}
              </Link>
            </div>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        Stampers are supplied by {BRAND.company} and billed once on your first invoice.
      </p>
    </section>
  );
}
