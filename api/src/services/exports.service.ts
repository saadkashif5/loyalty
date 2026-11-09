import { isValidObjectId } from "mongoose";
import { ExportJob, LoyaltyCard } from "@/models";
import { EXPORT_KIND, EXPORT_STATUS } from "@/models/ExportJob";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { runAcrossTenants } from "@/models/tenantGuard";
import { openFile, saveFile } from "@/services/storage.service";
import { invoicesCsv, toCsv } from "@/modules/billing/export.service";
import { maskEmail, maskPhone } from "@/modules/customers/customers.service";

const KEEP_DAYS = 7;
/** Lets Excel open the file as UTF-8 (Urdu names and all). */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const MAX_ATTEMPTS = 3;
/** A job claimed longer ago than this is assumed lost with its worker. */
const STALE_MS = 10 * 60_000;

type ExportKind = (typeof EXPORT_KIND)[keyof typeof EXPORT_KIND];

export async function requestExport(input: {
  kind: ExportKind;
  requestedBy: string;
  businessId?: string;
  params?: Record<string, unknown>;
}) {
  const job = await ExportJob.create({
    ...input,
    expiresAt: new Date(Date.now() + KEEP_DAYS * 86_400_000),
  });
  return job;
}

export async function listExports(filter: { requestedBy?: string; businessId?: string }) {
  return ExportJob.find(filter).sort({ createdAt: -1 }).limit(20);
}

/** The finished file of one export, for whoever may see it. */
export async function openExport(jobId: string, filter: Record<string, unknown>) {
  if (!isValidObjectId(jobId)) throw ApiError.notFound("Export not found");
  const job = await ExportJob.findOne({ _id: jobId, ...filter }).select("+fileKey");
  if (!job) throw ApiError.notFound("Export not found");
  if (job.status !== EXPORT_STATUS.DONE || !job.fileKey) {
    throw ApiError.conflict("This export is not ready yet");
  }
  return { stream: openFile(job.fileKey), fileName: job.fileName ?? "export.csv" };
}

const day = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) : "";

/** A business's loyalty customers, one row per card, contact details masked. */
async function customersCsv(businessId: string): Promise<{ csv: string; rows: number }> {
  const rows: unknown[][] = [
    ["Customer", "Phone", "Email", "Program", "Stamps", "Joined", "Last stamp", "Status"],
  ];
  const cursor = LoyaltyCard.find({ businessId })
    .sort({ joinedAt: 1 })
    .populate<{ customerId: { name: string; phone?: string; email?: string } | null }>(
      "customerId",
      "name phone email",
    )
    .populate<{ programId: { name: string } | null }>("programId", "name")
    .cursor();
  for await (const card of cursor) {
    rows.push([
      card.customerId?.name ?? "Deleted account",
      maskPhone(card.customerId?.phone) ?? "",
      maskEmail(card.customerId?.email) ?? "",
      card.programId?.name ?? "",
      card.stampCount,
      day(card.joinedAt),
      day(card.lastStampAt),
      card.status,
    ]);
  }
  return { csv: toCsv(rows), rows: rows.length - 1 };
}

async function build(job: InstanceType<typeof ExportJob>) {
  const params = (job.params ?? {}) as { from?: string; to?: string };
  if (job.kind === EXPORT_KIND.INVOICES_CSV) {
    const from = new Date(params.from ?? 0);
    const to = new Date(params.to ?? Date.now());
    const csv = await invoicesCsv(from, to);
    return {
      csv,
      rows: Math.max(0, csv.trim().split("\r\n").length - 1),
      fileName: `invoices-${day(from)}-to-${day(new Date(to.getTime() - 1))}.csv`,
    };
  }
  const { csv, rows } = await customersCsv(String(job.businessId));
  return { csv, rows, fileName: `customers-${day(new Date())}.csv` };
}

/**
 * Builds queued exports, one at a time. Each job is claimed atomically, so
 * several workers can run; a job whose worker died is picked up again.
 * Returns how many were finished.
 */
export async function processExports(limit = 5): Promise<number> {
  let done = 0;
  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const job = await ExportJob.findOneAndUpdate(
      {
        $or: [
          { status: EXPORT_STATUS.QUEUED },
          { status: EXPORT_STATUS.RUNNING, claimedAt: { $lt: new Date(now.getTime() - STALE_MS) } },
        ],
        attempts: { $lt: MAX_ATTEMPTS },
      },
      { $set: { status: EXPORT_STATUS.RUNNING, claimedAt: now }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) break;

    try {
      // Platform and per-business exports both read outside any tenant.
      const { csv, rows, fileName } = await runAcrossTenants(() => build(job));
      const fileKey = await saveFile(
        "exports",
        Buffer.from(`${BYTE_ORDER_MARK}${csv}`, "utf8"),
        "csv",
      );
      await ExportJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: EXPORT_STATUS.DONE,
            fileKey,
            fileName,
            rows,
            finishedAt: new Date(),
          },
        },
      );
      done += 1;
    } catch (err) {
      logger.error({ err, exportId: job.id }, "Export failed");
      const final = job.attempts >= MAX_ATTEMPTS;
      await ExportJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: final ? EXPORT_STATUS.FAILED : EXPORT_STATUS.QUEUED,
            error: final ? "The export could not be built. Please try again." : undefined,
          },
        },
      );
    }
  }
  return done;
}
