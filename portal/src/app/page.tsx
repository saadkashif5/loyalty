import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { Card } from "@/components/ui";
import { ClearOfflineData } from "@/components/ClearOfflineData";
import { getT } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  if (!deleted && (await getAccessToken())) redirect("/cards");
  const t = await getT();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-5">
      <ClearOfflineData />
      {deleted ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          {t("home.deleted")}
        </p>
      ) : null}
      <div className="text-center">
        <p className="text-3xl font-bold text-brand-600">TapTapSell</p>
        <p className="mt-2 text-slate-600">{t("home.tagline")}</p>
      </div>
      <Card className="space-y-3 text-center">
        <p className="text-lg font-semibold">{t("home.tapTitle")}</p>
        <p className="text-sm text-slate-600">{t("home.tapBody")}</p>
      </Card>
      <Link
        href="/signin"
        className="block rounded-xl border border-slate-300 bg-white py-3 text-center font-medium"
      >
        {t("home.signIn")}
      </Link>
      <Link href="/business" className="text-center text-sm text-slate-500 hover:text-slate-900">
        {t("home.forBusiness")}
      </Link>
      <LanguageSwitch />
    </main>
  );
}
