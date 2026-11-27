"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteBusinessAction } from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import { Button, Card, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

const CATEGORIES = [
  ["CAFE", "Café"],
  ["RESTAURANT", "Restaurant"],
  ["BAKERY", "Bakery"],
  ["SALON", "Salon"],
  ["BARBER", "Barber"],
  ["GYM", "Gym"],
  ["RETAIL", "Retail"],
  ["OTHER", "Other"],
] as const;

export interface InvitePrefill {
  leadId?: string;
  businessName?: string;
  category?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create business and invite owner"}
    </Button>
  );
}

export function InviteBusinessForm({
  prefill,
  plans,
}: {
  prefill: InvitePrefill;
  plans: Array<{ code: string; name: string; isPublic: boolean; isActive: boolean }>;
}) {
  const [state, formAction] = useActionState(inviteBusinessAction, {});

  if (state.inviteUrl && state.businessId) {
    return (
      <Card className="space-y-4">
        <p className="font-medium text-mint-700">Business created and owner invited.</p>
        <p className="text-sm text-ink-600">
          We emailed the owner this link. It works once and expires in 7 days. If it does not
          arrive, copy it and send it on WhatsApp.
        </p>
        <CopyLink url={state.inviteUrl} />
        <Link
          href={`/businesses/${state.businessId}`}
          className="inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          Open the business →
        </Link>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {prefill.leadId ? <input type="hidden" name="leadId" value={prefill.leadId} /> : null}

      <Card className="space-y-4">
        <h2 className="font-semibold">Business</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="businessName" required defaultValue={prefill.businessName} />
          </Field>
          <Field label="Category">
            <Select name="category" defaultValue={prefill.category ?? "CAFE"}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Business phone (optional)">
            <Input name="businessPhone" inputMode="tel" placeholder="042 35761234" />
          </Field>
          <Field label="Address (optional)">
            <Input name="address" defaultValue={prefill.address} />
          </Field>
          <Field label="City">
            <Input
              name="city"
              required
              maxLength={80}
              defaultValue={prefill.city}
              placeholder="Lahore"
            />
          </Field>
        </div>
        <Field label="Description (optional)">
          <Textarea name="description" rows={2} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Owner</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="ownerName" required defaultValue={prefill.ownerName} />
          </Field>
          <Field label="Email">
            <Input name="ownerEmail" type="email" required defaultValue={prefill.ownerEmail} />
          </Field>
          <Field label="Mobile (optional)">
            <Input
              name="ownerPhone"
              inputMode="tel"
              placeholder="0300 1234567"
              defaultValue={prefill.ownerPhone}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Plan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            <Select name="planCode" defaultValue="STARTER">
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                  {p.isPublic ? "" : " (hidden)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Free trial (days, from when the owner accepts)">
            <Input name="trialDays" type="number" min={0} max={90} defaultValue={30} />
          </Field>
        </div>
      </Card>

      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
