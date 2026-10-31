"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, {});
  const [useRecovery, setUseRecovery] = useState(false);

  if (state.mfaToken) {
    return (
      <Card>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mfaToken" value={state.mfaToken} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-slate-600">
            {useRecovery
              ? "Enter one of the recovery codes you saved when you set up two-step verification."
              : "Open your authenticator app and enter the 6-digit code for TapTapSell."}
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
          <SubmitButton label="Verify" pendingLabel="Verifying…" />
          <button
            type="button"
            onClick={() => setUseRecovery(!useRecovery)}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-900"
          >
            {useRecovery
              ? "Use a code from my app instead"
              : "Lost your phone? Use a recovery code"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
      </form>
    </Card>
  );
}
