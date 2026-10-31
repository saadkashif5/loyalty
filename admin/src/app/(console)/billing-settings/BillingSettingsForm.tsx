"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveBillingSettingsAction } from "@/app/actions";
import { Button, Card, ErrorText, Field, Input, Textarea } from "@/components/ui";

export interface BillingSettings {
  companyName?: string;
  address?: string;
  ntn?: string;
  strn?: string;
  email?: string;
  phone?: string;
  taxLabel?: string;
  taxRatePercent?: number;
  invoicePrefix?: string;
  bankAccounts?: Array<{
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string;
  }>;
  raastId?: string;
  paymentInstructions?: string;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

export function BillingSettingsForm({
  settings,
  canEdit,
}: {
  settings: BillingSettings;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(saveBillingSettingsAction, {});
  const accounts = settings.bankAccounts ?? [];

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">On every invoice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input name="companyName" required defaultValue={settings.companyName} />
            </Field>
            <Field label="Invoice prefix">
              <Input
                name="invoicePrefix"
                required
                defaultValue={settings.invoicePrefix ?? "TTS"}
                className="uppercase"
              />
            </Field>
            <Field label="NTN">
              <Input name="ntn" defaultValue={settings.ntn} />
            </Field>
            <Field label="STRN">
              <Input name="strn" defaultValue={settings.strn} />
            </Field>
            <Field label="Billing email">
              <Input name="email" type="email" defaultValue={settings.email} />
            </Field>
            <Field label="Billing phone / WhatsApp">
              <Input name="phone" defaultValue={settings.phone} />
            </Field>
          </div>
          <Field label="Address">
            <Input name="address" defaultValue={settings.address} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Tax</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label on invoices">
              <Input name="taxLabel" defaultValue={settings.taxLabel ?? "Sales tax"} />
            </Field>
            <Field label="Rate (%)">
              <Input
                name="taxRatePercent"
                type="number"
                step="0.01"
                min={0}
                max={50}
                defaultValue={settings.taxRatePercent ?? 0}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            Provincial sales tax on services varies by province. Confirm the rate with your tax
            adviser. Changes apply to invoices issued from now on.
          </p>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Where owners pay</h2>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-4">
              <Field label={`Bank ${i + 1}`}>
                <Input
                  name={`bankName${i}`}
                  defaultValue={accounts[i]?.bankName}
                  placeholder="Meezan Bank"
                />
              </Field>
              <Field label="Account title">
                <Input name={`accountTitle${i}`} defaultValue={accounts[i]?.accountTitle} />
              </Field>
              <Field label="Account number">
                <Input name={`accountNumber${i}`} defaultValue={accounts[i]?.accountNumber} />
              </Field>
              <Field label="IBAN">
                <Input name={`iban${i}`} defaultValue={accounts[i]?.iban} placeholder="PK36…" />
              </Field>
            </div>
          ))}
          <Field label="Raast ID (mobile number or IBAN)">
            <Input name="raastId" defaultValue={settings.raastId} />
          </Field>
          <Field label="Extra instructions for owners">
            <Textarea
              name="paymentInstructions"
              rows={2}
              defaultValue={settings.paymentInstructions}
            />
          </Field>
        </Card>
      </fieldset>

      <ErrorText>{state.error}</ErrorText>
      {state.done ? <p className="text-sm text-emerald-700">Saved.</p> : null}
      {canEdit ? (
        <Submit />
      ) : (
        <p className="text-sm text-slate-500">Only Finance and Super Admins can edit.</p>
      )}
    </form>
  );
}
