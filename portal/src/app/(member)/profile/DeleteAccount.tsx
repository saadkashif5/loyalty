"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction } from "@/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-red-600 py-3 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete my account for good"}
    </button>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccountAction, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 text-sm text-red-700"
      >
        Delete my account
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-900">
        This removes your name, email and all your loyalty cards. Stamps and unclaimed rewards are
        lost and cannot be brought back.
      </p>
      <label className="block text-sm text-red-900">
        Type DELETE to confirm
        <input
          name="confirm"
          required
          autoComplete="off"
          className="mt-1 w-full rounded-2xl border border-red-300 bg-white px-3 py-2"
        />
      </label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
