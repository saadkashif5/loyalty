"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AuthShell } from "@taptapsell/brand/auth-shell";
import { registerAction } from "@/app/actions/auth";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, {});

  return (
    <AuthShell
      area="Business"
      title="Create your account"
      subtitle="For staff joining a business. Owners get their link by invitation."
      headline="Bring your regulars back."
      blurb="Run your stamp cards, stampers and rewards from one place."
      footer={
        <p className="text-ink-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Card>
        <form action={formAction} className="space-y-4">
          <Field label="Your name">
            <Input name="name" required autoComplete="name" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <ErrorText>{state.error}</ErrorText>
          <SubmitButton />
        </form>
      </Card>
    </AuthShell>
  );
}
