import Link from "next/link";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      area="Admin"
      title="Forgot your password?"
      subtitle="We will email you a link to choose a new one."
      headline="Platform console."
      blurb="Businesses, stampers, billing and support, in one place."
      footer={
        <Link href="/login" className="text-slate-500 hover:text-slate-900">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
