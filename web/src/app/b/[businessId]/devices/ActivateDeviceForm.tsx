"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { activateDeviceAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Activating…" : "Activate stamper"}
    </Button>
  );
}

export function ActivateDeviceForm({
  businessId,
  branches,
  deviceIdentifier,
}: {
  businessId: string;
  branches: { _id: string; name: string }[];
  /** Filled in from the QR code on the stamper's label. */
  deviceIdentifier?: string;
}) {
  const action = activateDeviceAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});

  if (branches.length === 0) {
    return (
      <Card className="h-fit text-sm text-slate-500">
        Create a branch first — every stamper belongs to one.
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Activate a stamper</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Stamper ID">
          <Input
            name="deviceIdentifier"
            required
            placeholder="TAP123"
            className="uppercase"
            defaultValue={deviceIdentifier}
          />
        </Field>
        <Field label="Activation code">
          <Input
            name="activationCode"
            required
            placeholder="ACTIV8ME"
            className="uppercase"
            autoFocus={Boolean(deviceIdentifier)}
          />
        </Field>
        <Field label="Branch">
          <select
            name="branchId"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          Both codes are printed on the card shipped with your stamper.
        </p>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton />
      </form>
    </Card>
  );
}
