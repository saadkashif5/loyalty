"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  assignDeviceAction,
  resendInvitationAction,
  revokeInvitationAction,
  setBusinessStatusAction,
} from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import {
  Button,
  DangerButton,
  ErrorText,
  Field,
  Input,
  Select,
  SecondaryButton,
} from "@/components/ui";

function Submit({ label, danger = false }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  const Component = danger ? DangerButton : Button;
  return (
    <Component type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Component>
  );
}

export function StatusForm({ businessId, status }: { businessId: string; status: string }) {
  const [state, formAction] = useActionState(setBusinessStatusAction.bind(null, businessId), {});
  const suspending = status !== "SUSPENDED";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="status" value={suspending ? "SUSPENDED" : "ACTIVE"} />
      <Field label={suspending ? "Reason for suspending" : "Reason for restoring"}>
        <Input
          name="reason"
          required
          maxLength={500}
          placeholder={suspending ? "e.g. unpaid invoice" : ""}
        />
      </Field>
      <p className="text-xs text-slate-500">
        {suspending
          ? "Suspending stops every stamper at this business immediately. It is recorded in the audit log."
          : "Restoring re-activates its suspended stampers."}
      </p>
      <ErrorText>{state.error}</ErrorText>
      <Submit label={suspending ? "Suspend business" : "Restore business"} danger={suspending} />
    </form>
  );
}

export function InvitationActions({
  invitationId,
  businessId,
}: {
  invitationId: string;
  businessId: string;
}) {
  const [state, resend] = useActionState(
    resendInvitationAction.bind(null, invitationId, businessId),
    {},
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={resend}>
          <SecondaryButton type="submit">New link</SecondaryButton>
        </form>
        <form action={revokeInvitationAction.bind(null, invitationId, businessId)}>
          <DangerButton type="submit">Revoke</DangerButton>
        </form>
      </div>
      {state.inviteUrl ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">New link (the previous one no longer works):</p>
          <CopyLink url={state.inviteUrl} />
        </div>
      ) : null}
      <ErrorText>{state.error}</ErrorText>
    </div>
  );
}

export function AssignDeviceForm({
  businessId,
  devices,
  branches,
}: {
  businessId: string;
  devices: Array<{ _id: string; deviceIdentifier: string }>;
  branches: Array<{ _id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(assignDeviceAction.bind(null, businessId), {});

  if (branches.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        The owner must create a branch before a stamper can be assigned.
      </p>
    );
  }
  if (devices.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No unassigned stampers. Create some on the Stampers page.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Field label="Stamper">
        <Select name="deviceId" required>
          {devices.map((d) => (
            <option key={d._id} value={d._id}>
              {d.deviceIdentifier}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Branch">
        <Select name="branchId" required>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Submit label="Assign" />
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
