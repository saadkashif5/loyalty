import Link from "next/link";

const STEPS = [
  {
    title: "Tap",
    body: "A small TapTapSell stamper sits on your counter. After paying, the customer holds their phone to it.",
  },
  {
    title: "Collect",
    body: "Their card opens in the browser with the new stamp. No app to install, no paper card to lose.",
  },
  {
    title: "Come back",
    body: "When the card is full, a reward unlocks. Your staff check the code and hand it over.",
  },
];

const FEATURES = [
  [
    "Fraud-resistant stamping",
    "Every tap is checked, copied links are refused, and unusual activity raises an alert.",
  ],
  ["Counter mode", "Customers whose phones cannot tap show a code; staff scan it."],
  [
    "Your customers, your data",
    "See who comes back, who is close to a reward, and how your branches compare.",
  ],
  [
    "Multiple branches and staff",
    "Give each staff member their own login and limits. Every stamp is recorded.",
  ],
  [
    "Rewards that expire",
    "Optional expiry for rewards and stamps, with reminders sent to customers.",
  ],
  [
    "Pay in PKR",
    "Monthly or yearly, by bank transfer or Raast, with proper invoices for your accountant.",
  ],
] as const;

export default function BusinessHome() {
  return (
    <>
      <section className="bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Loyalty cards your customers will not lose
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Digital stamp cards for cafés, bakeries, salons and shops in Pakistan. Customers tap
            their phone on your counter; you see who keeps coming back.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/business/request-access"
              className="rounded-xl bg-brand-600 px-5 py-3 font-medium text-white"
            >
              Request access
            </Link>
            <Link
              href="/business/pricing"
              className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">30-day free trial. We set you up in person.</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-center text-2xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 p-6">
              <p className="text-sm font-semibold text-brand-600">Step {i + 1}</p>
              <p className="mt-1 text-lg font-semibold">{step.title}</p>
              <p className="mt-2 text-sm text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-center text-2xl font-semibold">Built for the counter</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 text-center">
        <h2 className="text-2xl font-semibold">Ready to try it?</h2>
        <p className="mt-2 text-slate-600">
          Tell us about your business. We will call you to arrange a stamper and a short setup.
        </p>
        <Link
          href="/business/request-access"
          className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-medium text-white"
        >
          Request access
        </Link>
      </section>
    </>
  );
}
