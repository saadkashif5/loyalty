"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Email me a link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});

  if (state.sent) {
    return (
      <Card className="space-y-2 text-sm">
        <p className="font-medium">Check your email</p>
        <p className="text-ink-600">
          If an account uses that address, a link is on its way. It works once, for 30 minutes.
          Nothing arrived? Check spam, or try again in a minute.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" autoFocus />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <Submit />
      </form>
    </Card>
  );
}
