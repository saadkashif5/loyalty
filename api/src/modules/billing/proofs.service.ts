import { PaymentProof } from "@/models";
import { PROOF_STATUS } from "@/models/PaymentProof";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { openFile, saveFile, sniffType } from "@/services/storage.service";
import type { UploadProofInput } from "@taptapsell/validation";
import { getInvoice } from "./invoices.service";
import { emailOwners, recordPayment } from "./subscriptions.service";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** An owner's receipt for an open invoice. Only images and PDFs, judged by content. */
export async function uploadProof(params: {
  businessId: string;
  invoiceId: string;
  userId: string;
  file: Buffer;
  input: UploadProofInput;
}) {
  const invoice = await getInvoice(params.invoiceId, params.businessId);
  if (invoice.status !== "ISSUED") {
    throw ApiError.conflict(`Invoice ${invoice.number} is not open for payment`);
  }
  if (params.file.length === 0 || params.file.length > MAX_PROOF_BYTES) {
    throw ApiError.badRequest("Upload a file up to 5 MB");
  }
  const type = sniffType(params.file);
  if (!type) throw ApiError.badRequest("Upload a photo (JPG, PNG, WebP) or a PDF of the receipt");

  const fileKey = await saveFile("proofs", params.file, type.extension);
  const proof = await PaymentProof.create({
    businessId: params.businessId,
    invoiceId: invoice._id,
    uploadedBy: params.userId,
    fileKey,
    mimeType: type.mime,
    sizeBytes: params.file.length,
    ...params.input,
  });

  await recordAudit({
    actorUserId: params.userId,
    businessId: params.businessId,
    action: AUDIT_ACTIONS.PAYMENT_PROOF_UPLOADED,
    resourceType: "PaymentProof",
    resourceId: proof._id,
    metadata: { invoice: invoice.number, amountPkr: params.input.amountPkr },
  });
  return proof;
}

export async function listProofs(status: string = PROOF_STATUS.PENDING) {
  return PaymentProof.find(status === "ALL" ? {} : { status })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate("businessId", "name")
    .populate("invoiceId", "number totalPkr status")
    .populate("uploadedBy", "name email");
}

export async function openProofFile(proofId: string) {
  const proof = await PaymentProof.findById(proofId).select("fileKey mimeType");
  if (!proof) throw ApiError.notFound("Receipt not found");
  return { stream: openFile(proof.fileKey), mimeType: proof.mimeType };
}

/** Checked against the bank statement: records the payment, which settles the invoice. */
export async function approveProof(actorUserId: string, proofId: string) {
  const proof = await PaymentProof.findOneAndUpdate(
    { _id: proofId, status: PROOF_STATUS.PENDING },
    { $set: { status: PROOF_STATUS.APPROVED, reviewedBy: actorUserId, reviewedAt: new Date() } },
    { new: true },
  );
  if (!proof) throw ApiError.conflict("This receipt has already been reviewed");

  try {
    const result = await recordPayment(actorUserId, proof.businessId.toString(), {
      invoiceId: proof.invoiceId.toString(),
      amountPkr: proof.amountPkr,
      method: proof.method as "BANK_TRANSFER" | "RAAST" | "CHEQUE" | "OTHER",
      reference: proof.reference ?? undefined,
      periods: 1,
      note: `Receipt ${proof._id.toString()}`,
    });

    await recordAudit({
      actorUserId,
      businessId: proof.businessId,
      action: AUDIT_ACTIONS.PAYMENT_PROOF_APPROVED,
      resourceType: "PaymentProof",
      resourceId: proof._id,
    });
    return result;
  } catch (err) {
    // Nothing was recorded; put the receipt back in the queue.
    await PaymentProof.updateOne(
      { _id: proof._id },
      { $set: { status: PROOF_STATUS.PENDING }, $unset: { reviewedBy: "", reviewedAt: "" } },
    );
    throw err;
  }
}

export async function rejectProof(actorUserId: string, proofId: string, reason: string) {
  const proof = await PaymentProof.findOneAndUpdate(
    { _id: proofId, status: PROOF_STATUS.PENDING },
    {
      $set: {
        status: PROOF_STATUS.REJECTED,
        reviewedBy: actorUserId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    },
    { new: true },
  ).populate<{ invoiceId: { number: string } }>("invoiceId", "number");
  if (!proof) throw ApiError.conflict("This receipt has already been reviewed");

  await recordAudit({
    actorUserId,
    businessId: proof.businessId,
    action: AUDIT_ACTIONS.PAYMENT_PROOF_REJECTED,
    resourceType: "PaymentProof",
    resourceId: proof._id,
    metadata: { reason },
  });
  await emailOwners(
    proof.businessId.toString(),
    `We could not confirm your payment for invoice ${proof.invoiceId.number}`,
    `The receipt you uploaded could not be matched to a payment: ${reason}. ` +
      "Please check the details and upload it again from Billing in your dashboard.",
  );
  return proof;
}
