"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendReminderAction } from "@/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send reminder"}
    </button>
  );
}

/** Emails the owners what they owe and how to pay; at most once a day per business. */
export function RemindButton({
  businessId,
  lastSentAt,
}: {
  businessId: string;
  lastSentAt: string | null;
}) {
  const [state, formAction] = useActionState(sendReminderAction.bind(null, businessId), {});
  const recent = lastSentAt && Date.now() - new Date(lastSentAt).getTime() < 86_400_000;

  if (state.done) return <span className="text-xs text-green-700">Sent</span>;
  if (recent) return <span className="text-xs text-slate-500">Reminded today</span>;
  return (
    <form action={formAction} className="space-y-1">
      <Submit />
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
