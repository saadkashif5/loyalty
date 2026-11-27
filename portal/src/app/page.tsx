import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@taptapsell/brand";
import { Byline } from "@taptapsell/brand/byline";
import { Logo } from "@taptapsell/brand/logo";
import { getAccessToken } from "@/lib/session";
import { ClearOfflineData } from "@/components/ClearOfflineData";
import { getT } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { StamperHero } from "@/components/landing/StamperHero";
import {
  ArrowIcon,
  BellIcon,
  CardsIcon,
  Flower,
  GiftIcon,
  PhoneIcon,
  QrIcon,
  StampIcon,
  TapIcon,
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  if (!deleted && (await getAccessToken())) redirect("/cards");
  const t = await getT();

  const places = (
    [
      "home.place1",
      "home.place2",
      "home.place3",
      "home.place4",
      "home.place5",
      "home.place6",
      "home.place7",
      "home.place8",
    ] as const
  ).map((key) => t(key));

  const features = [
    {
      title: t("home.feature1Title"),
      body: t("home.feature1Body"),
      icon: <PhoneIcon />,
      tint: "bg-brand-500/10 text-brand-600",
    },
    {
      title: t("home.feature2Title"),
      body: t("home.feature2Body"),
      icon: <CardsIcon />,
      tint: "bg-accent-300/25 text-accent-700",
    },
    {
      title: t("home.feature3Title"),
      body: t("home.feature3Body"),
      icon: <BellIcon />,
      tint: "bg-mint/15 text-mint-700",
    },
    {
      title: t("home.feature4Title"),
      body: t("home.feature4Body"),
      icon: <QrIcon />,
      tint: "bg-ink/5 text-ink",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-crema text-ink">
      <ClearOfflineData />

      <header className="sticky top-0 z-40 border-b border-ink/5 bg-crema/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" aria-label={BRAND.name}>
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5">
            <Link
              href="/business"
              className="hidden text-sm font-medium text-ink-600 transition hover:text-ink sm:block"
            >
              {t("home.navBusiness")}
            </Link>
            <Link href="/signin" className={BUTTON.ink}>
              {t("home.signIn")}
            </Link>
          </nav>
        </div>
      </header>

      {deleted ? (
        <p className="mx-auto mt-6 max-w-md rounded-2xl bg-mint-50 px-4 py-3 text-center text-sm text-mint-800">
          {t("home.deleted")}
        </p>
      ) : null}

      <main>
        {/* Hero */}
        <section className="relative">
          <DotGrid />
          <div className="relative mx-auto grid max-w-6xl items-center gap-x-10 gap-y-16 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_1fr] md:pb-28 md:pt-16">
            <div>
              <Eyebrow>{t("home.eyebrow")}</Eyebrow>
              <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                {t("home.heroTitle")}
              </h1>
              <svg
                aria-hidden
                viewBox="0 0 300 16"
                className="mt-3 h-3 w-48 text-brand-500 sm:w-64"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 11C60 4 140 2 297 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
                {t("home.heroBody")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signin" className={BUTTON.primary}>
                  {t("home.getStarted")}
                  <ArrowIcon className="h-5 w-5" />
                </Link>
                <a href="#how" className={BUTTON.secondary}>
                  {t("home.howTitle")}
                </a>
              </div>
              <div className="mt-8">
                <Assurances
                  items={t("home.heroNote")
                    .split("·")
                    .map((s) => s.trim())}
                />
              </div>
            </div>

            <StamperHero
              modelLabel={t("home.stamperLabel")}
              hint={t("home.stamperHint")}
              shopName={t("home.sampleShop")}
              shopInitial={t("home.sampleShop").charAt(0)}
              stampCount={t("home.stampCount", { count: "{count}" })}
              reward={t("home.sampleReward")}
              rewardUnlocked={t("home.rewardUnlocked")}
            />
          </div>
        </section>

        <Ticker label={t("home.placesTitle")} items={places} />

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionHeading title={t("home.howTitle")} body={t("home.howBody")} />
          <StepCards
            steps={[
              {
                title: t("home.step1Title"),
                body: t("home.step1Body"),
                icon: <TapIcon className="h-7 w-7" />,
              },
              {
                title: t("home.step2Title"),
                body: t("home.step2Body"),
                icon: <StampIcon className="h-7 w-7" />,
              },
              {
                title: t("home.step3Title"),
                body: t("home.step3Body"),
                icon: <GiftIcon className="h-7 w-7" />,
              },
            ]}
          />
        </section>

        {/* Why */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <SectionHeading align="start" title={t("home.whyTitle")} body={t("home.whyBody")} />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f.title} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-ink/5">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${f.tint}`}
                >
                  {f.icon}
                </span>
                <p className="mt-5 font-display text-xl font-bold text-ink">{f.title}</p>
                <p className="mt-1.5 text-ink-600">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* For shops */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-8 py-12 sm:px-12 md:py-16">
            <div
              aria-hidden
              className="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-brand-500/35 blur-3xl"
            />
            <Flower className="absolute -bottom-24 -end-16 h-80 w-80 text-brand-500 opacity-90 md:-bottom-20 md:end-10 md:h-96 md:w-96" />
            <div className="relative max-w-lg">
              <p className="font-display text-4xl font-bold leading-tight tracking-tight text-crema sm:text-5xl">
                {t("home.businessTitle")}
              </p>
              <p className="mt-4 text-lg text-ink-200">{t("home.businessBody")}</p>
              <Link href="/business" className={`${BUTTON.onDark} mt-8`}>
                {t("home.businessCta")}
                <ArrowIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-8 text-sm text-ink-500 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo size="sm" />
            <p>
              <Byline linkClassName="font-medium text-ink-700 underline-offset-2 hover:text-ink hover:underline" />{" "}
              · {t("home.madeIn")}
            </p>
          </div>
          <LanguageSwitch />
        </div>
      </footer>
    </div>
  );
}
