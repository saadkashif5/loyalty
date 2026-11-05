"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { endSupportViewAction, startSupportViewAction } from "@/app/actions";
import { Button, ErrorText, Field, Input, SecondaryButton } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Opening…" : "Open support view"}
    </Button>
  );
}

/** Starts or ends a read-only, 30-minute look at the business's own dashboard. */
export function SupportViewForm({
  businessId,
  active,
  dashboardUrl,
}: {
  businessId: string;
  active: { expiresAt: string } | null;
  dashboardUrl: string;
}) {
  const [state, formAction] = useActionState(startSupportViewAction.bind(null, businessId), {});
  const url = state.dashboardUrl ?? (active ? dashboardUrl : undefined);

  if (active || url) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Your support view is open
          {active ? ` until ${new Date(active.expiresAt).toLocaleTimeString("en-PK")}` : ""}. Sign
          in to the business dashboard with your own team account to use it.
        </p>
        <div className="flex flex-wrap gap-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-brand-500 px-3 py-2 font-medium text-white hover:bg-brand-600"
            >
              Open dashboard ↗
            </a>
          ) : null}
          <form action={endSupportViewAction.bind(null, businessId)}>
            <SecondaryButton type="submit">End support view</SecondaryButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Why do you need to look?">
        <Input
          name="reason"
          required
          minLength={5}
          maxLength={300}
          placeholder="e.g. owner says stamps are missing"
        />
      </Field>
      <p className="text-xs text-slate-500">
        Read-only, for 30 minutes. The reason and every page you open are recorded in the audit log,
        and every dashboard page you see is marked as a support view.
      </p>
      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
