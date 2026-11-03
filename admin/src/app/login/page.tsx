import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">TapTapSell Admin</h1>
          <p className="text-sm text-slate-500">Platform console for the TapTapSell team</p>
        </div>

        {denied ? (
          <Card className="space-y-3 text-sm">
            <p>This account is not on the TapTapSell team.</p>
            <form action={logoutAction}>
              <SecondaryButton type="submit" className="w-full">
                Sign out
              </SecondaryButton>
            </form>
          </Card>
        ) : (
          <>
            {reset ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
                Password changed. Sign in with your new password.
              </p>
            ) : null}
            <LoginForm />
            <p className="text-center text-sm">
              <Link href="/forgot-password" className="text-slate-500 hover:text-slate-900">
                Forgot your password?
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
