import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">Choose a new password</h1>
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
      </div>
    </main>
  );
}
