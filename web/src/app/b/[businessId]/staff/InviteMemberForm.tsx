"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BRAND } from "@taptapsell/brand";
import { inviteMemberAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Inviting…" : "Send invite"}
    </Button>
  );
}

export function InviteMemberForm({ businessId }: { businessId: string }) {
  const action = inviteMemberAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Invite someone</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="person@example.com" />
        </Field>
        <Field label="Role">
          <select
            name="role"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          They need a {BRAND.name} account already. They accept the invite from their own account.
        </p>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton />
      </form>
    </Card>
  );
}
