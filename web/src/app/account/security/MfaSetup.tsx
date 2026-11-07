"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BRAND } from "@taptapsell/brand";
import { mfaSetupAction } from "@/app/actions/auth";
import { Button, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function MfaSetup() {
  const [state, formAction] = useActionState(mfaSetupAction, {});

  if (state.recoveryCodes) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-emerald-700">Two-step verification is on.</p>
        <p className="text-sm text-slate-600">
          Save these recovery codes somewhere safe. Each one signs you in once if you lose your
          phone. They will not be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-4 font-mono text-sm">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link
          href="/businesses"
          className="inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          I have saved them — continue
        </Link>
      </div>
    );
  }

  if (state.secret && state.qrDataUrl) {
    return (
      <form action={formAction} className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Install an authenticator app (Google Authenticator or Microsoft Authenticator).</li>
          <li>Scan this code with the app, or type the key below.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        {/* A data URL generated on the server; next/image adds nothing here. */}
        <img
          src={state.qrDataUrl}
          alt="QR code for your authenticator app"
          width={220}
          height={220}
        />
        <p className="break-all rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {state.secret}
        </p>
        <Field label="Code from the app">
          <Input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
          />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton label="Turn on" pendingLabel="Checking…" />
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-600">
        Each time you sign in, you will enter a code from an app on your phone as well as your
        password. Business owners and the {BRAND.name} team must use it.
      </p>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton label="Set up two-step verification" pendingLabel="Starting…" />
    </form>
  );
}
