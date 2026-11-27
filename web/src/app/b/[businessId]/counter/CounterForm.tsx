"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { counterStampAction, lookupCounterAction, type CounterState } from "@/app/actions/business";
import { QrScanner } from "@/components/QrScanner";
import { Button, Card, ErrorText, Field, Input, Select } from "@/components/ui";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-3">
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Scan or type the customer's code → check who it is → add the stamp. */
export function CounterForm({
  businessId,
  branches,
}: {
  businessId: string;
  branches: Array<{ _id: string; name: string }>;
}) {
  // A fresh form (and idempotency key) per customer.
  const [round, setRound] = useState(0);
  return (
    <CounterRound
      key={round}
      businessId={businessId}
      branches={branches}
      onNext={() => setRound((r) => r + 1)}
    />
  );
}

function CounterRound({
  businessId,
  branches,
  onNext,
}: {
  businessId: string;
  branches: Array<{ _id: string; name: string }>;
  onNext: () => void;
}) {
  const [lookupState, lookup] = useActionState(lookupCounterAction.bind(null, businessId), {});
  const [stampState, stamp] = useActionState(
    async (_prev: CounterState, formData: FormData) =>
      counterStampAction(businessId, lookupState, formData),
    {},
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const lookupForm = useRef<HTMLFormElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const onScan = useCallback((value: string) => {
    if (!codeInput.current) return;
    codeInput.current.value = value.slice(0, 8).toUpperCase();
    lookupForm.current?.requestSubmit();
  }, []);

  if (stampState.pending) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-lg font-semibold text-accent-700">Sent for approval</p>
        <p className="text-sm text-ink-600">
          You have added a lot of stamps today, so a manager needs to approve this one. The customer
          gets the stamp as soon as they do.
        </p>
        <Button type="button" onClick={onNext} className="w-full py-3">
          Next customer
        </Button>
      </Card>
    );
  }

  if (stampState.done) {
    const { stampCount, requiredStamps, rewards } = stampState.done;
    return (
      <Card className="space-y-3 text-center">
        <p className="text-lg font-semibold text-mint-700">Stamp added</p>
        <p className="text-sm text-ink-600">
          {stampCount} of {requiredStamps} stamps
        </p>
        {rewards.length > 0 ? (
          <p className="rounded-xl bg-mint-50 px-3 py-2 text-sm text-mint-800">
            Reward unlocked: {rewards.join(", ")}. It is now on the customer&apos;s card.
          </p>
        ) : null}
        <Button type="button" onClick={onNext} className="w-full py-3">
          Next customer
        </Button>
      </Card>
    );
  }

  if (lookupState.lookup) {
    const { customer, card } = lookupState.lookup;
    return (
      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold">{customer.name}</p>
          <p className="text-sm text-ink-500">{customer.phone ?? customer.email}</p>
        </div>
        <p className="text-sm">
          {card.program}: <strong>{card.stampCount}</strong> of {card.requiredStamps} stamps
        </p>
        <form action={stamp} className="space-y-3">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
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
          ) : (
            <input type="hidden" name="branchId" value={branches[0]?._id ?? ""} />
          )}
          <ErrorText>{stampState.error}</ErrorText>
          <Submit label="Add stamp" pendingLabel="Adding…" />
        </form>
        <button type="button" onClick={onNext} className="w-full text-sm text-ink-500">
          Not this customer
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm text-ink-600">
        Ask the customer to open their card and tap “Show at counter”.
      </p>
      <QrScanner onScan={onScan} />
      <form ref={lookupForm} action={lookup} className="space-y-3">
        <Field label="Or type the 8-character code">
          <Input
            ref={codeInput}
            name="code"
            required
            autoComplete="off"
            maxLength={8}
            pattern="[A-Za-z2-9]{8}"
            className="text-center font-mono text-lg uppercase tracking-widest"
          />
        </Field>
        <ErrorText>{lookupState.error}</ErrorText>
        <Submit label="Check" pendingLabel="Checking…" />
      </form>
    </Card>
  );
}
