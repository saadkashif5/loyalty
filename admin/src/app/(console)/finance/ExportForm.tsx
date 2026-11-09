"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestInvoiceExportAction } from "@/app/actions";
import { ErrorText } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Starting…" : "Prepare CSV"}
    </button>
  );
}

export function ExportForm() {
  const [state, action] = useActionState(requestInvoiceExportAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="block">
        <span className="mb-1 block text-slate-600">From</span>
        <input type="date" name="from" className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-600">To</span>
        <input type="date" name="to" className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <Submit />
      {state.done ? (
        <p className="w-full text-emerald-700">Preparing. Refresh in a moment to download.</p>
      ) : null}
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
