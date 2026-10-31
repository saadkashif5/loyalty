import { PlatformSetting } from "@/models";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { BillingSettingsInput } from "@taptapsell/validation";

/** The billing settings, created with defaults the first time they are read. */
export async function getBillingSettings() {
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: "billing" },
    { $setOnInsert: { key: "billing" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.billing!;
}

export async function updateBillingSettings(actorUserId: string, input: BillingSettingsInput) {
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: "billing" },
    { $set: { key: "billing", billing: input } },
    { upsert: true, new: true, runValidators: true },
  );

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.BILLING_SETTINGS_UPDATED,
    resourceType: "PlatformSetting",
    resourceId: doc._id,
    metadata: { taxRatePercent: input.taxRatePercent, bankAccounts: input.bankAccounts.length },
  });
  return doc.billing!;
}

/** What owners need to pay: shown on their Billing page and in invoice emails. */
export async function getPaymentDetails() {
  const s = await getBillingSettings();
  return {
    companyName: s.companyName,
    bankAccounts: s.bankAccounts,
    raastId: s.raastId ?? null,
    instructions: s.paymentInstructions ?? null,
    email: s.email ?? null,
    phone: s.phone ?? null,
  };
}
