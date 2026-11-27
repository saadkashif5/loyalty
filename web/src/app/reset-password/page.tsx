import Link from "next/link";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      area="Business"
      title="Choose a new password"
      headline="Bring your regulars back."
      blurb="Run your stamp cards, stampers and rewards from one place."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-sm text-ink-600">
          This link is incomplete.{" "}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Ask for a new one
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
