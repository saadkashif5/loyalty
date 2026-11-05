import { apiFetch } from "@/lib/api";
import { setWhatsappConsentAction, signOutAction } from "@/app/actions";
import { Card } from "@/components/ui";
import { DeleteAccount } from "./DeleteAccount";
import { ProfileForm } from "./ProfileForm";
import { getT } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";

interface Consent {
  businessId: string;
  business: string;
  whatsapp: boolean;
}

export default async function ProfilePage() {
  const t = await getT();
  const [me, consents] = await Promise.all([
    apiFetch<{ name: string; email: string; phone?: string | null }>("/users/me"),
    apiFetch<Consent[]>("/users/me/consents"),
  ]);

  return (
    <>
      <h1 className="text-lg font-semibold">{t("profile.title")}</h1>
      <LanguageSwitch />
      <p className="text-sm text-slate-500">{me.email}</p>
      <ProfileForm name={me.name} phone={me.phone} />

      {consents.length > 0 ? (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">{t("profile.whatsapp")}</h2>
            <p className="text-xs text-slate-500">
              {t("profile.whatsappHelp")}
              {me.phone ? "" : t("profile.addNumberFirst")}
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {consents.map((c) => (
              <li key={c.businessId} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">{c.business}</span>
                <form action={setWhatsappConsentAction.bind(null, c.businessId, !c.whatsapp)}>
                  <button
                    type="submit"
                    disabled={!c.whatsapp && !me.phone}
                    aria-pressed={c.whatsapp}
                    className={`rounded-full px-3 py-1 text-sm font-medium disabled:opacity-40 ${
                      c.whatsapp
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-300 text-slate-700"
                    }`}
                  >
                    {c.whatsapp ? t("profile.allowed") : t("profile.allow")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <a
        href="/files/my-data"
        className="block w-full rounded-xl border border-slate-300 bg-white py-3 text-center font-medium text-slate-700"
      >
        {t("profile.download")}
      </a>
      <form action={signOutAction}>
        <button className="w-full rounded-xl border border-slate-300 bg-white py-3 font-medium text-slate-700">
          {t("profile.signOut")}
        </button>
      </form>
      <DeleteAccount />
    </>
  );
}
