"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, {});
  const [useRecovery, setUseRecovery] = useState(false);

  if (state.mfaToken) {
    return (
      <Card>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mfaToken" value={state.mfaToken} />
          <p className="text-sm text-ink-600">
            {useRecovery
              ? "Enter one of your saved recovery codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
          {useRecovery ? (
            <Field label="Recovery code">
              <Input name="recoveryCode" required autoComplete="off" placeholder="ABCD-EFGH" />
            </Field>
          ) : (
            <Field label="Code">
              <Input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                autoFocus
              />
            </Field>
          )}
          <ErrorText>{state.error}</ErrorText>
          <Submit label="Verify" pendingLabel="Verifying…" />
          <button
            type="button"
            onClick={() => setUseRecovery(!useRecovery)}
            className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
          >
            {useRecovery ? "Use a code from my app instead" : "Use a recovery code"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" required autoComplete="current-password" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <Submit label="Sign in" pendingLabel="Signing in…" />
      </form>
    </Card>
  );
}
