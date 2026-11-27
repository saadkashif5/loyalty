"use client";

import { PLAN_FEATURE_LABELS } from "@taptapsell/constants";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPlanAction, updatePlanAction } from "@/app/actions";
import { LIMIT_LABELS, type Plan } from "@/lib/billing";
import { Button, ErrorText, Field, Input } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Edits an existing plan, or creates one when no plan is given. Blank limit = unlimited. */
export function PlanForm({ plan }: { plan?: Plan }) {
  const [state, formAction] = useActionState(
    plan ? updatePlanAction.bind(null, plan._id) : createPlanAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {plan ? null : (
          <Field label="Code">
            <Input name="code" required placeholder="SEASONAL" className="uppercase" />
          </Field>
        )}
        <Field label="Name">
          <Input name="name" required defaultValue={plan?.name} />
        </Field>
        <Field label="Monthly (PKR)">
          <Input
            name="priceMonthlyPkr"
            type="number"
            min={0}
            required
            defaultValue={plan?.priceMonthlyPkr}
          />
        </Field>
        <Field label="Annual (PKR)">
          <Input
            name="priceAnnualPkr"
            type="number"
            min={0}
            required
            defaultValue={plan?.priceAnnualPkr}
          />
        </Field>
      </div>
      <Field label="Description">
        <Input name="description" defaultValue={plan?.description} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-5">
        {LIMIT_LABELS.map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              name={key}
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={plan?.limits[key] ?? undefined}
            />
          </Field>
        ))}
      </div>
      <fieldset className="space-y-1 text-sm">
        <legend className="mb-1 font-medium text-ink-700">Features in this plan</legend>
        {(
          Object.entries(PLAN_FEATURE_LABELS) as Array<[keyof typeof PLAN_FEATURE_LABELS, string]>
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`flag-${key}`}
              defaultChecked={plan?.flags?.[key] ?? true}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPublic" defaultChecked={plan?.isPublic ?? true} />
          Offered to businesses
        </label>
        {plan ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked={plan.isActive} />
            Available
          </label>
        ) : null}
      </div>
      {plan ? (
        <p className="text-xs text-ink-500">
          Saving creates version {plan.version + 1}. Businesses already on this plan keep their
          current price and limits.
        </p>
      ) : null}
      <ErrorText>{state.error}</ErrorText>
      {state.done ? <p className="text-sm text-mint-700">Saved.</p> : null}
      <Submit label={plan ? "Save plan" : "Create plan"} />
    </form>
  );
}
