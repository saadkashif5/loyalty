"use client";

import { useActionState, useCallback, useRef } from "react";
import { useFormStatus } from "react-dom";
import { validateRedemptionAction } from "@/app/actions/business";
import { QrScanner } from "@/components/QrScanner";
import { Button, Card, ErrorText, Field, Input, Select } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Checking…" : "Validate reward"}
    </Button>
  );
}

export function RedeemForm({
  businessId,
  branches,
}: {
  businessId: string;
  branches: Array<{ _id: string; name: string }>;
}) {
  const action = validateRedemptionAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // The reward QR on the customer's card holds just the code.
  const onScan = useCallback((value: string) => {
    if (!codeRef.current) return;
    codeRef.current.value = value.toUpperCase();
    formRef.current?.requestSubmit();
  }, []);

  return (
    <Card>
      <form ref={formRef} action={formAction} className="space-y-4">
        <QrScanner onScan={onScan} />
        <Field label="Redemption code">
          <Input
            ref={codeRef}
            name="redemptionCode"
            required
            autoFocus
            autoComplete="off"
            placeholder="e.g. K7M2QP4X"
            className="text-center text-lg uppercase tracking-widest"
          />
        </Field>

        {branches.length > 1 ? (
          <Field label="Branch">
            <Select name="branchId" required>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : branches.length === 1 ? (
          <input type="hidden" name="branchId" value={branches[0]._id} />
        ) : null}

        <ErrorText>{state.error}</ErrorText>
        {state.success ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </Card>
  );
}
