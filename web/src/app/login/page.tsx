import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold">TapTapSell Loyalty</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Business dashboard</p>

        <LoginForm next={next ?? "/businesses"} />

        <p className="mt-4 text-center text-sm text-slate-500">
          Staff member without an account?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
