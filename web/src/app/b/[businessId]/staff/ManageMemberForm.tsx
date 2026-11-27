"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateMemberAction } from "@/app/actions/business";
import { ErrorText, Field, SavedText, SecondaryButton, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </SecondaryButton>
  );
}

export function ManageMemberForm({
  businessId,
  member,
  branches,
}: {
  businessId: string;
  member: { _id: string; role: string; status: string; branchIds: string[] };
  branches: Array<{ _id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(
    updateMemberAction.bind(null, businessId, member._id),
    {},
  );

  return (
    <form action={formAction} className="space-y-3 border-t border-ink-100 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role">
          <Select name="role" defaultValue={member.role}>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </Select>
        </Field>
        {member.status === "INVITED" ? (
          <p className="self-end text-sm text-ink-500">Waiting for them to accept.</p>
        ) : (
          <Field label="Access">
            <Select name="status" defaultValue={member.status}>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </Select>
          </Field>
        )}
      </div>
      {branches.length > 1 ? (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">
            Works at (none ticked = every branch)
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {branches.map((branch) => (
              <label key={branch._id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="branchIds"
                  value={branch._id}
                  defaultChecked={member.branchIds.includes(branch._id)}
                />
                {branch.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex items-center gap-3">
        <Submit />
        <SavedText show={state.saved} />
        <ErrorText>{state.error}</ErrorText>
      </div>
    </form>
  );
}
