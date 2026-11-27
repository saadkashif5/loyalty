import PDFDocument from "pdfkit";
import { COLORS, PALETTE } from "@taptapsell/brand";
import type { InvoiceDocument } from "@/models";
import { getPaymentDetails } from "./settings.service";

// Brand colours (packages/brand), so invoices match the product.
const INK = PALETTE.midnightInk;
const MUTED = COLORS.ink[600];
const FAINT = PALETTE.steam;
const RULE = COLORS.ink[100];

const pkr = (n: number) => `PKR ${n.toLocaleString("en-PK")}`;
const day = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : "—";

/** A plain A4 invoice. Built from the invoice's own copy of seller and buyer details. */
export async function renderInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
  const payment = await getPaymentDetails();
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: { Title: `Invoice ${invoice.number}` },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );

  const { seller, buyer } = invoice;
  const right = 545;

  // A Stamp Orange band across the top of the page.
  doc.rect(0, 0, doc.page.width, 6).fill(PALETTE.stampOrange);

  // Seller
  doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text(seller.name, 50, 50);
  doc.fontSize(9).font("Helvetica").fillColor(MUTED);
  [
    seller.address,
    seller.ntn && `NTN: ${seller.ntn}`,
    seller.strn && `STRN: ${seller.strn}`,
    seller.email,
    seller.phone,
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line as string));

  // Title block
  doc
    .fillColor(INK)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("INVOICE", 350, 50, { width: 195, align: "right" });
  doc.fontSize(9).font("Helvetica").fillColor(MUTED);
  doc.text(`No. ${invoice.number}`, 350, 76, { width: 195, align: "right" });
  doc.text(`Issued: ${day(invoice.issuedAt)}`, { width: 195, align: "right" });
  doc.text(`Due: ${day(invoice.dueDate)}`, { width: 195, align: "right" });
  if (invoice.status !== "ISSUED") {
    doc
      .moveDown(0.3)
      .font("Helvetica-Bold")
      .fillColor(invoice.status === "PAID" ? COLORS.mint[700] : "#b91c1c");
    doc.text(invoice.status === "PAID" ? `PAID ${day(invoice.paidAt)}` : "VOID", {
      width: 195,
      align: "right",
    });
  }

  // Buyer
  doc.fillColor(INK).fontSize(10).font("Helvetica-Bold").text("Bill to", 50, 150);
  doc.font("Helvetica").fontSize(10).text(buyer.name);
  doc.fontSize(9).fillColor(MUTED);
  [buyer.address, buyer.ntn && `NTN: ${buyer.ntn}`, buyer.email, buyer.phone]
    .filter(Boolean)
    .forEach((line) => doc.text(line as string));

  // Lines
  let y = 230;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
  doc.text("Description", 50, y).text("Qty", 360, y, { width: 40, align: "right" });
  doc
    .text("Unit", 400, y, { width: 70, align: "right" })
    .text("Amount", 470, y, { width: 75, align: "right" });
  doc
    .moveTo(50, y + 14)
    .lineTo(right, y + 14)
    .strokeColor(RULE)
    .stroke();
  y += 22;
  doc.font("Helvetica").fontSize(9);
  for (const line of invoice.lines) {
    doc.text(line.description, 50, y, { width: 300 });
    doc.text(String(line.quantity), 360, y, { width: 40, align: "right" });
    doc.text(pkr(line.unitPkr), 400, y, { width: 70, align: "right" });
    doc.text(pkr(line.amountPkr), 470, y, { width: 75, align: "right" });
    y = Math.max(doc.y, y + 14) + 6;
  }

  // Totals
  y += 10;
  const total = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
    doc
      .text(label, 330, y, { width: 140, align: "right" })
      .text(value, 470, y, { width: 75, align: "right" });
    y += bold ? 18 : 14;
  };
  total("Subtotal", pkr(invoice.subtotalPkr));
  if (invoice.discountPkr)
    total(`Discount (${invoice.discountPercent}%)`, `- ${pkr(invoice.discountPkr)}`);
  if (invoice.coupon?.amountPkr)
    total(`Coupon ${invoice.coupon.code}`, `- ${pkr(invoice.coupon.amountPkr)}`);
  total(`${invoice.taxLabel} (${invoice.taxRatePercent}%)`, pkr(invoice.taxPkr));
  if (invoice.creditAppliedPkr)
    total("Credit from earlier credit notes", `- ${pkr(invoice.creditAppliedPkr)}`);
  doc.moveTo(330, y).lineTo(right, y).strokeColor(RULE).stroke();
  y += 6;
  total("Total", pkr(invoice.totalPkr), true);

  // How to pay
  if (invoice.status === "ISSUED") {
    y += 20;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text("How to pay", 50, y);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    for (const account of payment.bankAccounts) {
      doc.text(
        `${account.bankName} — ${account.accountTitle}, account ${account.accountNumber}${account.iban ? `, IBAN ${account.iban}` : ""}`,
      );
    }
    if (payment.raastId) doc.text(`Raast ID: ${payment.raastId}`);
    doc.text(
      `Please quote invoice number ${invoice.number} and upload the receipt in your dashboard under Billing.`,
    );
    if (payment.instructions) doc.text(payment.instructions);
  }

  doc
    .fontSize(8)
    .fillColor(FAINT)
    .text(
      `Service period: ${day(invoice.periodStart)} to ${day(invoice.periodEnd)}. Amounts in Pakistani rupees.`,
      50,
      780,
      { width: 495, align: "center" },
    );

  doc.end();
  return done;
}
