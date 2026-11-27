"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelPlanChangeAction, changePlanAction } from "@/app/actions/business";
import { ErrorText, SecondaryButton, formatDate } from "@/components/ui";

export interface PlanChangeQuote {
  kind: "CURRENT" | "NOW" | "PRORATED" | "PERIOD_END" | "CONTACT_TEAM";
  chargePkr: number;
  effectiveAt: string | null;
  blockers: string[];
  warnings: string[];
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </SecondaryButton>
  );
}

function explain(quote: PlanChangeQuote): string {
  if (quote.kind === "NOW") return "Starts straight away.";
  if (quote.kind === "PRORATED") {
    return `Starts straight away. PKR ${quote.chargePkr.toLocaleString("en-PK")} plus tax for the rest of this period goes on your next invoice.`;
  }
  return `Starts on ${formatDate(quote.effectiveAt)}, when your paid period ends.`;
}

/** Two steps, so an owner sees the charge and the date before anything changes. */
export function ChangePlanButton({
  businessId,
  planCode,
  billingCycle,
  label,
  quote,
}: {
  businessId: string;
  planCode: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  label: string;
  quote: PlanChangeQuote;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(changePlanAction.bind(null, businessId), {});

  if (quote.kind === "CURRENT") return null;
  if (quote.kind === "CONTACT_TEAM") {
    return <p className="text-xs text-ink-500">Contact the team to upgrade an annual plan.</p>;
  }
  if (quote.blockers.length > 0) {
    return <p className="text-xs text-accent-700">{quote.blockers.join(" ")}</p>;
  }
  if (!confirming) {
    return (
      <SecondaryButton type="button" onClick={() => setConfirming(true)}>
        {label}
      </SecondaryButton>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="planCode" value={planCode} />
      <input type="hidden" name="billingCycle" value={billingCycle} />
      <p className="text-xs text-ink-600">{explain(quote)}</p>
      {quote.warnings.map((warning) => (
        <p key={warning} className="text-xs text-accent-700">
          {warning}
        </p>
      ))}
      <ErrorText>{state.error}</ErrorText>
      <Submit label="Confirm" />
    </form>
  );
}

export function CancelChangeForm({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(cancelPlanChangeAction.bind(null, businessId), {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Submit label="Keep my current plan" />
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
