import { CreditNote, Invoice, Payment } from "@/models";

/**
 * Quotes a CSV cell. Text that a spreadsheet would read as a formula
 * (=, +, -, @) is prefixed with an apostrophe so it stays plain text.
 * Numbers (credit notes are negative) are safe as they are.
 */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const day = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) : "";

/**
 * Invoices issued in a date range, with how each was paid, and the credit
 * notes issued in it as negative rows — for the accountant.
 */
export async function invoicesCsv(from: Date, to: Date): Promise<string> {
  const invoices = await Invoice.find({ issuedAt: { $gte: from, $lt: to } })
    .sort({ issuedAt: 1 })
    .populate<{ businessId: { name: string } | null }>("businessId", "name");
  const payments = await Payment.find({ invoiceId: { $in: invoices.map((i) => i._id) } });
  const paymentFor = new Map(payments.map((p) => [String(p.invoiceId), p]));
  const notes = await CreditNote.find({ createdAt: { $gte: from, $lt: to } })
    .sort({ createdAt: 1 })
    .populate<{ businessId: { name: string } | null }>("businessId", "name");

  const header = [
    "Invoice",
    "Issued",
    "Business",
    "Plan",
    "Period start",
    "Period end",
    "Subtotal PKR",
    "Discount PKR",
    "Coupon PKR",
    "Tax rate %",
    "Tax PKR",
    "Credit applied PKR",
    "Total PKR",
    "Status",
    "Paid on",
    "Method",
    "Reference",
  ];
  const rows = invoices.map((inv) => {
    const p = paymentFor.get(String(inv._id));
    return [
      inv.number,
      day(inv.issuedAt),
      inv.businessId?.name ?? inv.buyer.name,
      inv.planCode,
      day(inv.periodStart),
      day(inv.periodEnd),
      inv.subtotalPkr,
      inv.discountPkr,
      inv.coupon?.amountPkr ?? 0,
      inv.taxRatePercent,
      inv.taxPkr,
      inv.creditAppliedPkr ?? 0,
      inv.totalPkr,
      inv.status,
      day(inv.paidAt),
      p?.method ?? "",
      p?.reference ?? "",
    ];
  });
  const noteRows = notes.map((n) => [
    n.number,
    day(n.createdAt),
    n.businessId?.name ?? "",
    `Credit note for ${n.invoiceNumber}`,
    "",
    "",
    -n.amountPkr,
    0,
    0,
    "",
    0,
    0,
    -n.amountPkr,
    n.outcome === "REFUND" ? "REFUNDED" : "CREDITED",
    day(n.createdAt),
    n.refund?.method ?? "",
    n.refund?.reference || n.reason,
  ]);

  return [header, ...rows, ...noteRows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
