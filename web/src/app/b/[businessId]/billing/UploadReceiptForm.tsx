"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadReceiptAction } from "@/app/actions/business";
import { Button, ErrorText, Field, Input, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading…" : "Send receipt"}
    </Button>
  );
}

export function UploadReceiptForm({
  businessId,
  invoiceId,
  amountPkr,
}: {
  businessId: string;
  invoiceId: string;
  amountPkr: number;
}) {
  const [state, action] = useActionState(uploadReceiptAction.bind(null, businessId, invoiceId), {});

  if (state.saved) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Receipt sent. We will check it against our bank statement, usually within one working day,
        and email you once it is approved.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Paid by">
          <Select name="method" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="RAAST">Raast</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Amount paid (PKR)">
          <Input name="amountPkr" type="number" min={1} required defaultValue={amountPkr} />
        </Field>
        <Field label="Transaction ID (optional)">
          <Input name="reference" maxLength={120} />
        </Field>
      </div>
      <Field label="Receipt (photo or PDF, up to 5 MB)">
        <Input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />
      </Field>
      <Field label="Note (optional)">
        <Input name="note" maxLength={500} />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
