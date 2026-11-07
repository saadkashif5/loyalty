import Link from "next/link";
import { BRAND } from "@taptapsell/brand";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { logoutAction } from "@/app/actions";
import { Card, SecondaryButton } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; reset?: string }>;
}) {
  const { denied, reset } = await searchParams;

  return (
    <AuthShell
      area="Admin"
      title="Sign in"
      subtitle={`Platform console for the ${BRAND.name} team.`}
      headline="Platform console."
      blurb="Businesses, stampers, billing and support, in one place."
      footer={
        denied ? null : (
          <Link href="/forgot-password" className="text-slate-500 hover:text-slate-900">
            Forgot your password?
          </Link>
        )
      }
    >
      {denied ? (
        <Card className="space-y-3 text-sm">
          <p>This account is not on the {BRAND.name} team.</p>
          <form action={logoutAction}>
            <SecondaryButton type="submit" className="w-full">
              Sign out
            </SecondaryButton>
          </form>
        </Card>
      ) : (
        <>
          {reset ? (
            <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
              Password changed. Sign in with your new password.
            </p>
          ) : null}
          <LoginForm />
        </>
      )}
    </AuthShell>
  );
}
