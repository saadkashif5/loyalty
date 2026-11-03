import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold">TapTapSell Loyalty</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Business dashboard</p>

        {reset ? (
          <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
            Password changed. Sign in with your new password.
          </p>
        ) : null}
        <LoginForm next={next ?? "/businesses"} />

        <div className="mt-4 space-y-2">
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-slate-500 hover:text-slate-900">
              Forgot your password?
            </Link>
          </p>
        </div>
        <p className="mt-2 text-center text-sm text-slate-500">
          Staff member without an account?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
