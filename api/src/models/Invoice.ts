import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const INVOICE_STATUS = { ISSUED: "ISSUED", PAID: "PAID", VOID: "VOID" } as const;

const lineSchema = new Schema(
  {
    description: { type: String, required: true, maxlength: 300 },
    quantity: { type: Number, required: true, min: 1 },
    unitPkr: { type: Number, required: true },
    amountPkr: { type: Number, required: true },
  },
  { _id: false },
);

const partySchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String },
    ntn: { type: String },
    strn: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

// A bill for a subscription period. Seller and buyer details are copied in at
// issue, so a printed invoice never changes when settings or profiles do.
// Amounts are whole rupees.
const invoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.ISSUED },
    issuedAt: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periods: { type: Number, required: true, min: 1 },
    billingCycle: { type: String, enum: ["MONTHLY", "ANNUAL"], required: true },
    planCode: { type: String, required: true },
    lines: { type: [lineSchema], required: true },
    subtotalPkr: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    discountPkr: { type: Number, default: 0 },
    taxLabel: { type: String, default: "Sales tax" },
    taxRatePercent: { type: Number, default: 0 },
    taxPkr: { type: Number, default: 0 },
    totalPkr: { type: Number, required: true },
    seller: { type: partySchema, required: true },
    buyer: { type: partySchema, required: true },
    paidAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

invoiceSchema.index({ businessId: 1, issuedAt: -1 });
invoiceSchema.index({ subscriptionId: 1, status: 1 });
invoiceSchema.index({ issuedAt: -1 });

export type InvoiceDocument = HydratedDocument<InferSchemaType<typeof invoiceSchema>>;
export const Invoice = model("Invoice", invoiceSchema, "invoices");
