import Link from "next/link";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { Card } from "@/components/ui";
import { EmailSignIn } from "@/components/EmailSignIn";
import { getT } from "@/lib/i18n";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getT();

  return (
    <AuthShell
      title={t("signin.title")}
      subtitle={t("signin.subtitle")}
      headline={t("home.whyTitle")}
      blurb={t("home.heroTitle")}
      footer={
        <Link href="/" className="text-ink-500 hover:text-ink-900">
          {t("signin.back")}
        </Link>
      }
    >
      <Card>
        <EmailSignIn next={next ?? "/cards"} />
      </Card>
    </AuthShell>
  );
}
