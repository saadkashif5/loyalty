import Link from "next/link";
import { redirect } from "next/navigation";
import { brandWithCompany } from "@taptapsell/brand";
import { Logo } from "@taptapsell/brand/logo";
import { getAccessToken } from "@/lib/session";
import { ClearOfflineData } from "@/components/ClearOfflineData";
import { getT, type Translate } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";

/** What a card looks like, so visitors get the idea before signing up. */
function SampleCard({ t }: { t: Translate }) {
  const filled = 7;
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 to-accent-200/50 blur-2xl"
      />
      <div className="relative rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5 md:rotate-2">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-100 text-lg font-bold text-accent-700">
            {t("home.sampleShop").charAt(0)}
          </span>
          <div>
            <p className="font-semibold text-slate-900">{t("home.sampleShop")}</p>
            <p className="text-sm text-slate-500">{t("home.sampleStamps")}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-3" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`flex aspect-square items-center justify-center rounded-full text-sm font-semibold ${
                i < filled
                  ? "bg-brand-500 text-white"
                  : i === 9
                    ? "border-2 border-dashed border-accent-400 text-accent-600"
                    : "border-2 border-dashed border-slate-200 text-slate-300"
              }`}
            >
              {i < filled ? "✓" : i === 9 ? "★" : i + 1}
            </span>
          ))}
        </div>
        <p className="mt-6 rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-800">
          {t("home.sampleReward")}
        </p>
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  if (!deleted && (await getAccessToken())) redirect("/cards");
  const t = await getT();

  const steps = [
    ["home.step1Title", "home.step1Body"],
    ["home.step2Title", "home.step2Body"],
    ["home.step3Title", "home.step3Body"],
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      <ClearOfflineData />
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Link
          href="/signin"
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        >
          {t("home.signIn")}
        </Link>
      </header>

      {deleted ? (
        <p className="mx-auto max-w-md rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          {t("home.deleted")}
        </p>
      ) : null}

      <main>
        <section className="bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-24">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t("home.heroTitle")}
              </h1>
              <p className="mt-5 text-lg text-slate-600">{t("home.heroBody")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signin"
                  className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  {t("home.getStarted")}
                </Link>
                <a
                  href="#how"
                  className="rounded-xl px-6 py-3 font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
                >
                  {t("home.howTitle")}
                </a>
              </div>
            </div>
            <SampleCard t={t} />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
            {t("home.howTitle")}
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map(([title, body], i) => (
              <li key={title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-600">
                  {i + 1}
                </span>
                <p className="mt-4 font-semibold text-slate-900">{t(title)}</p>
                <p className="mt-1 text-sm text-slate-600">{t(body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-2xl px-5 py-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t("home.whyTitle")}</h2>
          <p className="mt-4 text-lg text-slate-600">{t("home.whyBody")}</p>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-900 p-8 text-white md:flex-row md:items-center md:p-10">
            <div>
              <p className="text-xl font-semibold">{t("home.businessTitle")}</p>
              <p className="mt-1 text-brand-100">{t("home.businessBody")}</p>
            </div>
            <Link
              href="/business"
              className="shrink-0 rounded-xl bg-white px-5 py-3 font-semibold text-brand-800 transition hover:bg-brand-50"
            >
              {t("home.businessCta")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <p>
            {brandWithCompany} · {t("home.madeIn")}
          </p>
          <LanguageSwitch />
        </div>
      </footer>
    </div>
  );
}
