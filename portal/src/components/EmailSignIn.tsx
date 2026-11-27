"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "@/app/actions";
import { Button, ErrorText, Field, Input, Notice, TextButton } from "./ui";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const INITIAL: SignInState = { step: "email" };

/** Sign up and sign in are the same flow: email, then the code we send. */
export function EmailSignIn({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.notice ? <Notice>{state.notice}</Notice> : null}

      {state.step === "email" ? (
        <>
          <Field label="Your email">
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              defaultValue={state.email}
              placeholder="you@example.com"
            />
          </Field>
          <p className="text-xs text-ink-500">
            We will email you a code. No password needed. New here? This creates your account.
          </p>
          <ErrorText>{state.error}</ErrorText>
          <Submit label="Email me a code" pendingLabel="Sending…" />
        </>
      ) : null}

      {state.step === "code" ? (
        <>
          <Field label="6-digit code">
            <Input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              className="text-center text-2xl tracking-[0.5em]"
            />
          </Field>
          <ErrorText>{state.error}</ErrorText>
          <Submit label="Continue" pendingLabel="Checking…" />
          <TextButton type="submit" name="intent" value="resend" formNoValidate>
            Send a new code
          </TextButton>
        </>
      ) : null}

      {state.step === "name" ? (
        <>
          <Notice tone="success">Welcome! What should we call you?</Notice>
          <Field label="Your name">
            <Input name="name" required autoComplete="name" maxLength={120} autoFocus />
          </Field>
          <ErrorText>{state.error}</ErrorText>
          <Submit label="Create my account" pendingLabel="Creating…" />
        </>
      ) : null}

      {state.step === "mfa" ? (
        <>
          <Notice>Your account uses two-step verification. Enter the code from your app.</Notice>
          <Field label="Authenticator code">
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
          <ErrorText>{state.error}</ErrorText>
          <Submit label="Verify" pendingLabel="Checking…" />
        </>
      ) : null}
    </form>
  );
}
