import { describe, expect, it } from "vitest";
import { Business, Invoice, PaymentProof, Subscription } from "@/models";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { fiscalYear } from "@/modules/billing/invoices.service";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

const DAY = 86_400_000;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function onboard(rootToken: string, name = "Lahore Lassi", email = "owner@example.com") {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({ business: { name, category: "CAFE" }, owner: { name: "Owner", email } });
  const businessId = invite.body.data.business._id as string;
  const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
  const accepted = await api()
    .post(`/api/v1/invitations/${token}/accept`)
    .send({ password: PASSWORD });
  const ownerToken = accepted.body.data.accessToken as string;
  await enableMfa(ownerToken);
  return { businessId, ownerToken };
}

async function setBilling(rootToken: string, overrides: Record<string, unknown> = {}) {
  const res = await api()
    .put("/api/v1/admin/settings/billing")
    .set(bearer(rootToken))
    .send({
      companyName: "TapTapSell (Pvt) Ltd",
      address: "Gulberg III, Lahore",
      ntn: "1234567-8",
      invoicePrefix: "TTS",
      taxRatePercent: 16,
      bankAccounts: [
        {
          bankName: "Meezan Bank",
          accountTitle: "TapTapSell",
          accountNumber: "0102030405",
          iban: "PK36MEZN0001020304050607",
        },
      ],
      raastId: "03001234567",
      ...overrides,
    });
  expect(res.status).toBe(200);
}

function issue(rootToken: string, businessId: string, periods = 1) {
  return api()
    .post(`/api/v1/admin/businesses/${businessId}/invoices`)
    .set(bearer(rootToken))
    .send({ periods });
}

function uploadProof(
  ownerToken: string,
  businessId: string,
  invoiceId: string,
  file: Buffer,
  name: string,
) {
  return api()
    .post(`/api/v1/businesses/${businessId}/invoices/${invoiceId}/proofs`)
    .set(bearer(ownerToken))
    .field("method", "BANK_TRANSFER")
    .field("amountPkr", "3479")
    .field("reference", "IBFT-998877")
    .attach("file", file, name);
}

describe("invoices and payment proofs", () => {
  it("numbers invoices per fiscal year and applies discount and tax", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await setBilling(root.token);
    const { businessId } = await onboard(root.token);
    await api()
      .patch(`/api/v1/admin/businesses/${businessId}/subscription/discount`)
      .set(bearer(root.token))
      .send({ discountPercent: 10 });

    const res = await issue(root.token, businessId);
    const inv = res.body.data;
    expect(inv.number).toBe(`TTS-${fiscalYear(new Date())}-00001`);
    expect(inv.subtotalPkr).toBe(2999);
    expect(inv.discountPkr).toBe(300);
    expect(inv.taxPkr).toBe(432); // 16% of 2,699, rounded
    expect(inv.totalPkr).toBe(3131);
    expect(inv.seller.ntn).toBe("1234567-8");

    // One open invoice at a time: asking again returns the same one.
    expect((await issue(root.token, businessId)).body.data.number).toBe(inv.number);
  });

  it("settles a complimentary account's zero invoice by itself", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token);
    await api()
      .patch(`/api/v1/admin/businesses/${businessId}/subscription/discount`)
      .set(bearer(root.token))
      .send({ discountPercent: 100 });

    const inv = (await issue(root.token, businessId)).body.data;
    expect(inv.totalPkr).toBe(0);
    expect((await Invoice.findById(inv._id))!.status).toBe("PAID");
    expect((await Subscription.findOne({ businessId }))!.status).toBe("ACTIVE");
  });

  it("issues the renewal invoice a week ahead, once, and emails the owner how to pay", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await setBilling(root.token, { taxRatePercent: 0 });
    const { businessId } = await onboard(root.token, "Week Ahead", "week@example.com");
    await Subscription.updateOne({ businessId }, { trialEndsAt: new Date(Date.now() + 6 * DAY) });

    expect((await runSubscriptionJob()).invoiced).toBe(1);
    expect((await runSubscriptionJob()).invoiced).toBe(0);
    const email = testOutbox().find(
      (m) => m.to === "week@example.com" && m.subject.startsWith("Invoice"),
    );
    expect(email?.text).toContain("PK36MEZN0001020304050607");
    expect(email?.text).toContain("Raast");
  });

  it("refuses part payments and settles the invoice in full", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await setBilling(root.token);
    const { businessId } = await onboard(root.token);
    const inv = (await issue(root.token, businessId)).body.data;

    const short = await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(root.token))
      .send({ amountPkr: 2999, method: "CASH" });
    expect(short.body.error.code).toBe("PAYMENT_TOO_LOW");

    const paid = await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(root.token))
      .send({ amountPkr: inv.totalPkr, method: "CASH" });
    expect(paid.status).toBe(201);
    expect((await Invoice.findById(inv._id))!.status).toBe("PAID");
  });

  it("serves invoice PDFs to their own business only", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token);
    const other = await onboard(root.token, "Elsewhere", "other@example.com");
    const inv = (await issue(root.token, businessId)).body.data;

    const pdf = await api()
      .get(`/api/v1/businesses/${businessId}/invoices/${inv._id}/pdf`)
      .set(bearer(ownerToken))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");

    const crossTenant = await api()
      .get(`/api/v1/businesses/${other.businessId}/invoices/${inv._id}/pdf`)
      .set(bearer(other.ownerToken));
    expect(crossTenant.status).toBe(404);
  });

  it("takes receipts by content, lets an unpaid suspended owner upload, and restores on approval", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await setBilling(root.token);
    const { businessId, ownerToken } = await onboard(root.token);
    const inv = (await issue(root.token, businessId)).body.data;

    // Suspended for non-payment: uploading the receipt must still work.
    await Subscription.updateOne({ businessId }, { trialEndsAt: new Date(Date.now() - 1000) });
    await runSubscriptionJob();
    await Subscription.updateOne({ businessId }, { graceEndsAt: new Date(Date.now() - 1000) });
    await runSubscriptionJob();
    expect((await Business.findById(businessId))!.suspension?.kind).toBe("BILLING");

    const fake = await uploadProof(
      ownerToken,
      businessId,
      inv._id,
      Buffer.from("not an image"),
      "receipt.png",
    );
    expect(fake.status).toBe(400);

    const upload = await uploadProof(ownerToken, businessId, inv._id, PNG, "receipt.png");
    expect(upload.status).toBe(201);
    const proofId = upload.body.data._id as string;

    const queue = await api().get("/api/v1/admin/payment-proofs").set(bearer(root.token));
    expect(queue.body.data[0].invoiceId.number).toBe(inv.number);

    const file = await api()
      .get(`/api/v1/admin/payment-proofs/${proofId}/file`)
      .set(bearer(root.token));
    expect(file.headers["content-type"]).toBe("image/png");
    expect(file.headers["content-security-policy"]).toBe("sandbox");

    const approved = await api()
      .post(`/api/v1/admin/payment-proofs/${proofId}/approve`)
      .set(bearer(root.token));
    expect(approved.status).toBe(200);
    expect((await Invoice.findById(inv._id))!.status).toBe("PAID");
    expect((await Business.findById(businessId))!.status).toBe("ACTIVE");
    expect((await PaymentProof.findById(proofId))!.status).toBe("APPROVED");
  });

  it("puts a receipt back in the queue if approving it fails, and emails rejections", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await setBilling(root.token);
    const { businessId, ownerToken } = await onboard(
      root.token,
      "Proof Place",
      "proof@example.com",
    );
    const inv = (await issue(root.token, businessId)).body.data;

    // Claimed amount too low for the invoice: approval fails, receipt stays pending.
    const low = await api()
      .post(`/api/v1/businesses/${businessId}/invoices/${inv._id}/proofs`)
      .set(bearer(ownerToken))
      .field("method", "RAAST")
      .field("amountPkr", "100")
      .attach("file", PNG, "r.png");
    const approve = await api()
      .post(`/api/v1/admin/payment-proofs/${low.body.data._id}/approve`)
      .set(bearer(root.token));
    expect(approve.body.error.code).toBe("PAYMENT_TOO_LOW");
    expect((await PaymentProof.findById(low.body.data._id))!.status).toBe("PENDING");

    await api()
      .post(`/api/v1/admin/payment-proofs/${low.body.data._id}/reject`)
      .set(bearer(root.token))
      .send({ reason: "Amount does not match the invoice" });
    expect(
      testOutbox().some(
        (m) => m.to === "proof@example.com" && m.text.includes("Amount does not match"),
      ),
    ).toBe(true);
  });

  it("voids only unpaid invoices", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token);
    const inv = (await issue(root.token, businessId)).body.data;

    const voided = await api()
      .post(`/api/v1/admin/invoices/${inv._id}/void`)
      .set(bearer(root.token))
      .send({ reason: "Wrong plan" });
    expect(voided.body.data.status).toBe("VOID");

    const again = await api()
      .post(`/api/v1/admin/invoices/${inv._id}/void`)
      .set(bearer(root.token))
      .send({ reason: "Again" });
    expect(again.status).toBe(409);
  });

  it("exports invoices as CSV with formula-looking text neutralised", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "=HYPERLINK(evil)");
    const inv = (await issue(root.token, businessId)).body.data;

    const csv = await api().get("/api/v1/admin/billing/export.csv").set(bearer(root.token));
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain(inv.number);
    expect(csv.text).toContain(`"'=HYPERLINK(evil)"`);
  });

  it("starts the fiscal year on 1 July, Pakistan time", () => {
    expect(fiscalYear(new Date("2026-06-30T12:00:00Z"))).toBe("2025-26");
    expect(fiscalYear(new Date("2026-06-30T20:00:00Z"))).toBe("2026-27"); // 1 July 01:00 PKT
  });
});
