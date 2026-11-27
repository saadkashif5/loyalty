"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { BRAND } from "@taptapsell/brand";
import { codeLoginAction, loginAction, type CodeLoginState } from "@/app/actions/auth";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

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
  const [withCode, setWithCode] = useState(false);

  if (withCode) return <CodeLogin next={next} onBack={() => setWithCode(false)} />;

  if (state.mfaToken) {
    return (
      <Card>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mfaToken" value={state.mfaToken} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-ink-600">
            {useRecovery
              ? "Enter one of the recovery codes you saved when you set up two-step verification."
              : `Open your authenticator app and enter the 6-digit code for ${BRAND.name}.`}
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
            className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
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
          <PasswordInput name="password" required autoComplete="current-password" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
        <button
          type="button"
          onClick={() => setWithCode(true)}
          className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
        >
          No password? Email me a code instead
        </button>
      </form>
    </Card>
  );
}

const CODE_START: CodeLoginState = { step: "email" };

function CodeLogin({ next, onBack }: { next: string; onBack: () => void }) {
  const [state, formAction] = useActionState(codeLoginAction, CODE_START);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {state.notice ? <p className="text-sm text-ink-600">{state.notice}</p> : null}

        {state.step === "email" ? (
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={state.email}
            />
          </Field>
        ) : (
          <Field
            label={
              state.step === "mfa" ? "Code from your authenticator app" : "Code from the email"
            }
          >
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
        <SubmitButton
          label={state.step === "email" ? "Email me a code" : "Continue"}
          pendingLabel="Please wait…"
        />
        {state.step === "code" ? (
          <button
            type="submit"
            name="intent"
            value="resend"
            formNoValidate
            className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
          >
            Send a new code
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
        >
          Use my password instead
        </button>
      </form>
    </Card>
  );
}
