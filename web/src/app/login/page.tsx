import Link from "next/link";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

  return (
    <AuthShell
      area="Business"
      title="Sign in"
      subtitle="Welcome back to your business dashboard."
      headline="Bring your regulars back."
      blurb="Run your stamp cards, stampers and rewards from one place."
      footer={
        <>
          <p>
            <Link href="/forgot-password" className="text-ink-500 hover:text-ink-900">
              Forgot your password?
            </Link>
          </p>
          <p className="text-ink-500">
            Staff member without an account?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Create one
            </Link>
          </p>
        </>
      }
    >
      {reset ? (
        <p className="mb-4 rounded-xl bg-mint-50 px-3 py-2 text-center text-sm text-mint-800">
          Password changed. Sign in with your new password.
        </p>
      ) : null}
      <LoginForm next={next ?? "/businesses"} />
    </AuthShell>
  );
}
