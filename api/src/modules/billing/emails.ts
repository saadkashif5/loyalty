import { getPaymentDetails } from "./settings.service";

/** A date as people in Pakistan write it. */
export function day(d: Date) {
  return d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
}

/** The body of an invoice email: amount, due date and how to pay. */
export async function invoiceEmail(
  number: string,
  totalPkr: number,
  dueDate: Date,
): Promise<string> {
  const pay = await getPaymentDetails();
  const accounts = pay.bankAccounts
    .map(
      (a) =>
        `${a.bankName} — ${a.accountTitle}, account ${a.accountNumber}${a.iban ? `, IBAN ${a.iban}` : ""}`,
    )
    .join("\n");
  return [
    `Invoice ${number} for PKR ${totalPkr.toLocaleString("en-PK")} is due on ${day(dueDate)}.`,
    "",
    accounts ? `Pay by bank transfer to:\n${accounts}` : "",
    pay.raastId ? `Or by Raast to: ${pay.raastId}` : "",
    "",
    "Then upload the receipt from Billing in your dashboard. The invoice PDF is there too.",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}
