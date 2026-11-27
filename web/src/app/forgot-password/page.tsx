import Link from "next/link";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      area="Business"
      title="Forgot your password?"
      subtitle="We will email you a link to choose a new one."
      headline="Bring your regulars back."
      blurb="Run your stamp cards, stampers and rewards from one place."
      footer={
        <Link href="/login" className="text-ink-500 hover:text-ink-900">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
