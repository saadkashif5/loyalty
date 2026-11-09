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
      area="Admin"
      title="Choose a new password"
      headline="Platform console."
      blurb="Businesses, stampers, billing and support, in one place."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-sm text-slate-600">
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
