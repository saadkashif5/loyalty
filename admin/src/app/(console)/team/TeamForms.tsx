"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addTeamMemberAction, updateTeamMemberAction } from "@/app/actions";
import { Button, Card, ErrorText, Field, Input, SecondaryButton, Select } from "@/components/ui";

const ROLES = [
  ["SUPER_ADMIN", "Super Admin — everything"],
  ["ADMIN", "Admin — operations"],
  ["SUPPORT", "Support — read-only"],
  ["FINANCE", "Finance — billing"],
] as const;

function Submit({ label, secondary = false }: { label: string; secondary?: boolean }) {
  const { pending } = useFormStatus();
  const Component = secondary ? SecondaryButton : Button;
  return (
    <Component type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Component>
  );
}

export function AddTeamMemberForm() {
  const [state, formAction] = useActionState(addTeamMemberAction, {});

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Add someone</h2>
      <p className="text-sm text-slate-500">
        They need a TapTapSell account first. They must set up two-step verification before they can
        use the console.
      </p>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <Field label="Email">
          <Input name="email" type="email" required className="min-w-[16rem]" />
        </Field>
        <Field label="Role">
          <Select name="platformRole" defaultValue="SUPPORT">
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Submit label="Add" />
      </form>
      <ErrorText>{state.error}</ErrorText>
    </Card>
  );
}

export function ChangeRoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, formAction] = useActionState(updateTeamMemberAction.bind(null, userId), {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Select name="platformRole" defaultValue={role} className="max-w-[14rem]">
        {ROLES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
        <option value="REMOVE">Remove from team</option>
      </Select>
      <Submit label="Change" secondary />
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
