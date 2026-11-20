import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@taptapsell/brand";
import { StamperHero } from "@/components/landing/StamperHero";
import {
  ArrowIcon,
  ChartIcon,
  Flower,
  GiftIcon,
  QrIcon,
  ShieldIcon,
  StampIcon,
  TapIcon,
  UsersIcon,
  ClockIcon,
  WalletIcon,
} from "@/components/landing/icons";
import {
  Assurances,
  BUTTON,
  DotGrid,
  Eyebrow,
  SectionHeading,
  StepCards,
  Ticker,
} from "@/components/landing/parts";

const SHOP_TYPES = [
  "Cafés",
  "Bakeries",
  "Salons",
  "Juice bars",
  "Pharmacies",
  "Burger joints",
  "Sweet shops",
  "Bookshops",
];

const FEATURES: Array<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: "Fraud-resistant stamping",
    body: "Every tap is checked, copied links are refused, and unusual activity raises an alert.",
    icon: <ShieldIcon />,
  },
  {
    title: "Counter mode",
    body: "Customers whose phones cannot tap show a code; staff scan it.",
    icon: <QrIcon />,
  },
  {
    title: "Your customers, your data",
    body: "See who comes back, who is close to a reward, and how your branches compare.",
    icon: <ChartIcon />,
  },
  {
    title: "Multiple branches and staff",
    body: "Give each staff member their own login and limits. Every stamp is recorded.",
    icon: <UsersIcon />,
  },
  {
    title: "Rewards that expire",
    body: "Optional expiry for rewards and stamps, with reminders sent to customers.",
    icon: <ClockIcon />,
  },
  {
    title: "Pay in PKR",
    body: "Monthly or yearly, by bank transfer or Raast, with proper invoices for your accountant.",
    icon: <WalletIcon />,
  },
];

/** An illustration of the dashboard, not live figures. */
function DashboardPreview() {
  const bars = [38, 52, 44, 70, 58, 86, 64];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div
      aria-hidden
      className="relative rounded-[2rem] bg-white p-6 shadow-[0_30px_80px_-40px_rgb(var(--ink-900)/0.6)] ring-1 ring-ink/5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-steam">This week</p>
          <p className="mt-1 font-display text-xl font-bold text-ink">Stamps by day</p>
        </div>
        <span className="rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-mint-700">
          Sample
        </span>
      </div>
      <div className="mt-6 flex h-40 items-end gap-3">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div
              className={`w-full rounded-t-xl ${i === 5 ? "bg-brand-500" : "bg-ink/10"}`}
              style={{ height: `${h}%` }}
            />
            <span className="text-xs text-steam">{days[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-ink/5 pt-5 text-center">
        {[
          ["Regulars", "bg-brand-500"],
          ["Close to reward", "bg-accent-300"],
          ["Rewards earned", "bg-mint"],
        ].map(([label, dot]) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <span className="text-xs font-medium text-ink-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative">
        <DotGrid />
        <div className="relative mx-auto grid max-w-6xl items-center gap-x-10 gap-y-16 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_1fr] md:pb-28 md:pt-16">
          <div>
            <Eyebrow>For cafés, bakeries, salons and shops</Eyebrow>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Loyalty cards your customers will not{" "}
              <span className="relative whitespace-nowrap text-brand-500">
                lose
                <svg
                  aria-hidden
                  viewBox="0 0 300 16"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 start-0 h-3 w-full text-accent-300"
                >
                  <path
                    d="M3 11C60 4 140 2 297 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-600">
              Digital stamp cards for shops in Pakistan. Customers tap their phone on your counter;
              you see who keeps coming back.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/business/request-access" className={BUTTON.primary}>
                Request access
                <ArrowIcon className="h-5 w-5" />
              </Link>
              <Link href="/business/pricing" className={BUTTON.secondary}>
                See pricing
              </Link>
            </div>
            <div className="mt-8">
              <Assurances
                items={["30-day free trial", "We set you up in person", "No app for customers"]}
              />
            </div>
          </div>

          <StamperHero
            modelLabel={`3D model of the ${BRAND.name} stamper. Drag to turn it, or press Enter to add a stamp to the sample card.`}
            hint="Drag to spin · Tap to stamp"
            shopName="Chai Corner"
            shopInitial="C"
            stampCount="{count} of 10 stamps"
            reward="Free chai on the 10th visit"
            rewardUnlocked="Reward unlocked! A regular, earned."
            startAt={7}
          />
        </div>
      </section>

      <Ticker label="Made for" items={SHOP_TYPES} />

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <SectionHeading
          kicker="How it works"
          title="Tap. Collect. Come back."
          body={`A small ${BRAND.name} stamper sits by your till. The rest happens on your customer's phone.`}
        />
        <StepCards
          steps={[
            {
              title: "Tap",
              body: `A small ${BRAND.name} stamper sits on your counter. After paying, the customer holds their phone to it.`,
              icon: <TapIcon className="h-7 w-7" />,
            },
            {
              title: "Collect",
              body: "Their card opens in the browser with the new stamp. No app to install, no paper card to lose.",
              icon: <StampIcon className="h-7 w-7" />,
            },
            {
              title: "Come back",
              body: "When the card is full, a reward unlocks. Your staff check the code and hand it over.",
              icon: <GiftIcon className="h-7 w-7" />,
            },
          ]}
        />
      </section>

      {/* Features */}
      <section className="relative bg-ink py-24">
        <div
          aria-hidden
          className="absolute end-0 top-0 h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5">
          <SectionHeading
            tone="light"
            kicker="Built for the counter"
            title="Everything a busy till needs. Nothing it does not."
          />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="group rounded-[1.75rem] bg-white/[0.04] p-6 ring-1 ring-white/10 transition hover:bg-white/[0.07]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
                  {f.icon}
                </span>
                <p className="mt-5 font-display text-xl font-bold text-crema">{f.title}</p>
                <p className="mt-1.5 text-ink-200">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Dashboard */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="start"
            kicker="Your dashboard"
            title="See who keeps coming back."
            body="Every stamp and reward lands in one place, for every branch. Spot your regulars, see who is one visit from a reward, and compare how branches are doing."
          />
          <ul className="mt-8 space-y-3">
            {[
              "Customers, stamps and rewards for each branch",
              "Staff logins with their own limits",
              "Alerts when something looks unusual",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-ink-700">
                <Flower className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <DashboardPreview />
      </section>

      {/* Final call */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-500 px-8 py-14 text-center sm:px-12 md:py-20">
          <Flower className="absolute -start-20 -top-20 h-72 w-72 text-white/10" />
          <Flower className="absolute -bottom-24 -end-16 h-80 w-80 text-brand-600/60" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              Ready to bring your regulars back?
            </h2>
            <p className="mt-4 text-lg text-ink-800">
              Tell us about your business. We will call you to arrange a stamper and a short setup.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/business/request-access"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-display text-[17px] font-bold text-crema transition hover:bg-ink-700"
              >
                Request access
                <ArrowIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/business/pricing"
                className="inline-flex items-center justify-center rounded-full px-7 py-3.5 font-display text-[17px] font-semibold text-ink ring-2 ring-ink/80 transition hover:bg-ink/5"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-sm font-medium text-ink-800">
              30-day free trial. We set you up in person.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
