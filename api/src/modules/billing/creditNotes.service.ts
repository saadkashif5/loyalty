import { CreditNote, Invoice, Subscription } from "@/models";
import { CREDIT_OUTCOME } from "@/models/CreditNote";
import { INVOICE_STATUS } from "@/models/Invoice";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { CreditNoteInput } from "@taptapsell/validation";
import { getBillingSettings } from "./settings.service";
import { nextDocumentNumber } from "./invoices.service";
import { emailOwners } from "./subscriptions.service";

/**
 * Takes money back off a paid invoice: either refunded to the business (sent
 * outside the platform, recorded here) or kept as credit for its next
 * invoices. Credit notes on one invoice never add up to more than it charged.
 */
export async function issueCreditNote(
  actorUserId: string,
  invoiceId: string,
  input: CreditNoteInput,
) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status !== INVOICE_STATUS.PAID) {
    throw ApiError.badRequest("Only a paid invoice can be credited. Void an unpaid one instead.");
  }

  const [already] = await CreditNote.aggregate<{ total: number }>([
    { $match: { invoiceId: invoice._id } },
    { $group: { _id: null, total: { $sum: "$amountPkr" } } },
  ]);
  const left = invoice.totalPkr - (already?.total ?? 0);
  if (input.amountPkr > left) {
    throw ApiError.badRequest(
      `At most PKR ${left.toLocaleString("en-PK")} can still be credited on this invoice.`,
    );
  }

  const settings = await getBillingSettings();
  const note = await CreditNote.create({
    number: await nextDocumentNumber(
      "credit-note",
      `CN-${settings.invoicePrefix ?? "TTS"}`,
      new Date(),
    ),
    businessId: invoice.businessId,
    subscriptionId: invoice.subscriptionId,
    invoiceId: invoice._id,
    invoiceNumber: invoice.number,
    amountPkr: input.amountPkr,
    reason: input.reason,
    outcome: input.outcome,
    refund:
      input.outcome === CREDIT_OUTCOME.REFUND
        ? { method: input.refundMethod, reference: input.refundReference }
        : undefined,
    issuedBy: actorUserId,
  });

  if (input.outcome === CREDIT_OUTCOME.CREDIT) {
    await Subscription.updateOne(
      { _id: invoice.subscriptionId },
      { $inc: { creditBalancePkr: input.amountPkr } },
    );
  }

  await recordAudit({
    actorUserId,
    businessId: invoice.businessId,
    action: AUDIT_ACTIONS.CREDIT_NOTE_ISSUED,
    resourceType: "CreditNote",
    resourceId: note._id,
    metadata: {
      number: note.number,
      invoice: invoice.number,
      amountPkr: input.amountPkr,
      outcome: input.outcome,
    },
  });

  const amount = `PKR ${input.amountPkr.toLocaleString("en-PK")}`;
  await emailOwners(
    String(invoice.businessId),
    `Credit note ${note.number} for invoice ${invoice.number}`,
    [
      `We have issued credit note ${note.number} for ${amount} against invoice ${invoice.number}.`,
      `Reason: ${input.reason}`,
      "",
      input.outcome === CREDIT_OUTCOME.REFUND
        ? `The money has been sent back to you${input.refundReference ? ` (reference ${input.refundReference})` : ""}.`
        : "It will be taken off your next invoice.",
    ].join("\n"),
  );

  return note;
}

export async function listCreditNotes(businessId: string) {
  return CreditNote.find({ businessId }).sort({ createdAt: -1 }).limit(50);
}
