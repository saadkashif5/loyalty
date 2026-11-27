"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction } from "@/app/actions";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Save new password"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  return (
    <Card>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password (at least 8 characters)">
          <PasswordInput
            name="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            autoFocus
          />
        </Field>
        <Field label="Type it again">
          <PasswordInput name="confirm" required autoComplete="new-password" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        {state.error?.includes("Ask for a new one") ? (
          <Link href="/forgot-password" className="block text-sm text-brand-600 hover:underline">
            Ask for a new link
          </Link>
        ) : null}
        <Submit />
        <p className="text-xs text-ink-500">
          You will be signed out on every device, and asked to sign in again.
        </p>
      </form>
    </Card>
  );
}
