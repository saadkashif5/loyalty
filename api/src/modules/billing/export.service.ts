import { Invoice, Payment } from "@/models";

/**
 * Quotes a CSV cell. Cells that a spreadsheet would read as a formula
 * (=, +, -, @) are prefixed with an apostrophe so they stay plain text.
 */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const day = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) : "";

/** Invoices issued in a date range, with how each was paid — for the accountant. */
export async function invoicesCsv(from: Date, to: Date): Promise<string> {
  const invoices = await Invoice.find({ issuedAt: { $gte: from, $lt: to } })
    .sort({ issuedAt: 1 })
    .populate<{ businessId: { name: string } | null }>("businessId", "name");
  const payments = await Payment.find({ invoiceId: { $in: invoices.map((i) => i._id) } });
  const paymentFor = new Map(payments.map((p) => [String(p.invoiceId), p]));

  const header = [
    "Invoice",
    "Issued",
    "Business",
    "Plan",
    "Period start",
    "Period end",
    "Subtotal PKR",
    "Discount PKR",
    "Tax rate %",
    "Tax PKR",
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
      inv.taxRatePercent,
      inv.taxPkr,
      inv.totalPkr,
      inv.status,
      day(inv.paidAt),
      p?.method ?? "",
      p?.reference ?? "",
    ];
  });

  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
