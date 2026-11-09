import { Schema, model } from "mongoose";

export const EXPORT_KIND = {
  /** Invoices and credit notes for the accountant (platform finance). */
  INVOICES_CSV: "INVOICES_CSV",
  /** A business's loyalty customers, contact details masked (owners and managers). */
  CUSTOMERS_CSV: "CUSTOMERS_CSV",
} as const;

export const EXPORT_STATUS = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

// A file built by the worker rather than during a web request, so a large
// export never holds up the API. Files are kept for a week.
const exportJobSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(EXPORT_KIND), required: true },
    // Set for a business's own exports; absent for platform exports.
    businessId: { type: Schema.Types.ObjectId, ref: "Business" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(EXPORT_STATUS),
      default: EXPORT_STATUS.QUEUED,
    },
    attempts: { type: Number, default: 0 },
    claimedAt: { type: Date, default: null },
    fileKey: { type: String, private: true },
    fileName: { type: String },
    rows: { type: Number },
    error: { type: String, maxlength: 500 },
    finishedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

exportJobSchema.index({ status: 1, createdAt: 1 });
exportJobSchema.index({ requestedBy: 1, createdAt: -1 });
exportJobSchema.index({ businessId: 1, createdAt: -1 });
exportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ExportJob = model("ExportJob", exportJobSchema, "export_jobs");
