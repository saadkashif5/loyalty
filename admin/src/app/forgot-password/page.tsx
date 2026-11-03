import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold">Forgot your password?</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          We will email you a link to choose a new one.
        </p>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-slate-500 hover:text-slate-900">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
