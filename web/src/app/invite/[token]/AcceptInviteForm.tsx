"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvitationAction } from "@/app/actions/auth";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Setting up…" : label}
    </Button>
  );
}

/** New account: name and password. Existing, signed-in account: just confirm. */
export function AcceptInviteForm({
  token,
  newAccount,
  defaultName,
}: {
  token: string;
  newAccount: boolean;
  defaultName: string;
}) {
  const [state, formAction] = useActionState(acceptInvitationAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {newAccount ? (
        <>
          <Field label="Your name">
            <Input name="name" defaultValue={defaultName} required autoComplete="name" />
          </Field>
          <Field label="Choose a password">
            <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <PasswordInput
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
        </>
      ) : null}
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton label={newAccount ? "Create account and accept" : "Accept invitation"} />
    </form>
  );
}
