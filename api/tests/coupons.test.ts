import { describe, expect, it } from "vitest";
import { Invoice, Subscription } from "@/models";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

async function onboard(rootToken: string, name: string, email: string) {
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

async function setup() {
  const root = await platformUser("root@example.com", "SUPER_ADMIN");
  await api()
    .put("/api/v1/admin/settings/billing")
    .set(bearer(root.token))
    .send({ companyName: "TapTapSell", invoicePrefix: "TTS", taxRatePercent: 16 });
  const a = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
  const admin = (method: "get" | "post" | "patch" | "delete", path: string) =>
    api()[method](`/api/v1/admin${path}`).set(bearer(root.token));
  return { root, a, admin };
}

const ownerCoupon = (fx: { businessId: string; ownerToken: string }, code: string) =>
  api()
    .post(`/api/v1/businesses/${fx.businessId}/billing/coupon`)
    .set(bearer(fx.ownerToken))
    .send({ code });

describe("coupons", () => {
  it("takes a share off the plan for N invoices, and gives a use back when voided", async () => {
    const { a, admin } = await setup();
    const created = await admin("post", "/coupons").send({
      code: "launch50",
      percentOff: 50,
      invoices: 2,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe("LAUNCH50");
    expect(
      (await admin("post", "/coupons").send({ code: "BOTH", percentOff: 5, amountOffPkr: 9 }))
        .status,
    ).toBe(400);

    expect((await ownerCoupon(a, "nope")).status).toBe(400);
    expect((await ownerCoupon(a, "launch50")).status).toBe(200);

    const issued = await admin("post", `/businesses/${a.businessId}/invoices`).send({});
    const invoice = issued.body.data;
    expect(invoice.coupon).toMatchObject({ code: "LAUNCH50", amountPkr: 1500 });
    expect(invoice.totalPkr).toBe(Math.round(1499 * 1.16));
    expect((await Subscription.findOne())!.coupon!.invoicesLeft).toBe(1);

    await admin("post", `/invoices/${invoice._id}/void`).send({ reason: "Wrong period" });
    expect((await Subscription.findOne())!.coupon!.invoicesLeft).toBe(2);

    // Each code once per business, and only one coupon at a time for owners.
    expect((await ownerCoupon(a, "LAUNCH50")).status).toBe(409);
  });

  it("respects expiry, plans and the redemption limit", async () => {
    const { root, a, admin } = await setup();
    const b = await onboard(root.token, "Beta Bakery", "beta@example.com");
    await admin("post", "/coupons").send({
      code: "OLD",
      percentOff: 10,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await admin("post", "/coupons").send({ code: "PROONLY", percentOff: 10, planCodes: ["PRO"] });
    await admin("post", "/coupons").send({ code: "ONCE", percentOff: 10, maxRedemptions: 1 });

    expect((await ownerCoupon(a, "OLD")).body.error.message).toMatch(/expired/);
    expect((await ownerCoupon(a, "PROONLY")).body.error.message).toMatch(/not for the Starter/);
    expect((await ownerCoupon(a, "ONCE")).status).toBe(200);
    expect((await ownerCoupon(b, "ONCE")).body.error.message).toMatch(/used up/);

    // Switched off: no longer accepted.
    const list = await admin("get", "/coupons");
    const once = list.body.data.find((c: { code: string }) => c.code === "ONCE");
    expect(once.redemptions).toBe(1);
    await admin("post", "/coupons").send({ code: "PAUSED", percentOff: 10 });
    const paused = (await admin("get", "/coupons")).body.data.find(
      (c: { code: string }) => c.code === "PAUSED",
    );
    await admin("patch", `/coupons/${paused._id}`).send({ active: false });
    expect((await ownerCoupon(b, "PAUSED")).status).toBe(400);
  });

  it("applies to an open invoice at once, and a full-price coupon settles it", async () => {
    const { a, admin } = await setup();
    await admin("post", "/coupons").send({ code: "FREEMONTH", amountOffPkr: 999_999 });
    const open = await admin("post", `/businesses/${a.businessId}/invoices`).send({});
    expect(open.body.data.totalPkr).toBe(Math.round(2999 * 1.16));

    const applied = await admin("post", `/businesses/${a.businessId}/coupon`).send({
      code: "FREEMONTH",
    });
    expect(applied.status).toBe(200);
    const invoices = await Invoice.find().sort({ issuedAt: 1 });
    expect(invoices.map((i) => i.status)).toEqual(["VOID", "PAID"]);
    expect(invoices[1]!.coupon!.amountPkr).toBe(2999);
    expect(invoices[1]!.totalPkr).toBe(0);
  });
});

describe("credit notes", () => {
  it("credits a paid invoice as a refund or as credit for the next invoice", async () => {
    const { a, admin } = await setup();
    const issued = await admin("post", `/businesses/${a.businessId}/invoices`).send({});
    const invoice = issued.body.data;

    const credit = (body: object) =>
      admin("post", `/invoices/${invoice._id}/credit-notes`).send(body);
    expect(
      (await credit({ amountPkr: 500, reason: "Stamper down for a week", outcome: "CREDIT" }))
        .status,
    ).toBe(400); // not paid yet

    await admin("post", `/businesses/${a.businessId}/payments`).send({
      invoiceId: invoice._id,
      amountPkr: invoice.totalPkr,
      method: "BANK_TRANSFER",
    });

    expect(
      (await credit({ amountPkr: 500, reason: "Refund please", outcome: "REFUND" })).status,
    ).toBe(400); // how was it refunded?
    const refund = await credit({
      amountPkr: 500,
      reason: "Charged twice for a day",
      outcome: "REFUND",
      refundMethod: "BANK_TRANSFER",
      refundReference: "FT-123",
    });
    expect(refund.status).toBe(201);
    expect(refund.body.data.number).toMatch(/^CN-TTS-\d{4}-\d{2}-00001$/);

    const kept = await credit({
      amountPkr: 1000,
      reason: "Stamper down for a week",
      outcome: "CREDIT",
    });
    expect(kept.body.data.number).toMatch(/00002$/);
    expect((await Subscription.findOne())!.creditBalancePkr).toBe(1000);
    expect(
      (await credit({ amountPkr: invoice.totalPkr, reason: "Too much", outcome: "CREDIT" })).status,
    ).toBe(400);
    expect(testOutbox().some((m) => /Credit note CN-/.test(m.subject))).toBe(true);

    // The credit pays towards the next invoice, after tax.
    const next = await admin("post", `/businesses/${a.businessId}/invoices`).send({});
    expect(next.body.data.creditAppliedPkr).toBe(1000);
    expect(next.body.data.totalPkr).toBe(Math.round(2999 * 1.16) - 1000);
    expect((await Subscription.findOne())!.creditBalancePkr).toBe(0);

    // Owners see their credit notes; the accountant's export lists them.
    const billing = await api()
      .get(`/api/v1/businesses/${a.businessId}/billing`)
      .set(bearer(a.ownerToken));
    expect(billing.body.data.creditNotes).toHaveLength(2);
    const csv = await admin("get", "/billing/export.csv");
    expect(csv.text).toContain('"CN-TTS-');
    expect(csv.text).toContain('"-500"');
  });
});

describe("plan feature flags", () => {
  it("switch features off for businesses on the plan, keeping older snapshots as they were", async () => {
    const { root, a, admin } = await setup();
    const plans = await admin("get", "/plans");
    const starter = plans.body.data.find((p: { code: string }) => p.code === "STARTER");
    expect(starter.flags).toEqual({ counterMode: true, welcomeStamp: true, stampExpiry: true });

    const patched = await admin("patch", `/plans/${starter._id}`).send({
      flags: { counterMode: false, welcomeStamp: false },
    });
    expect(patched.body.data.flags).toEqual({
      counterMode: false,
      welcomeStamp: false,
      stampExpiry: true,
    });

    const b = await onboard(root.token, "Beta Bakery", "beta@example.com");
    const features = (fx: { businessId: string; ownerToken: string }) =>
      api().get(`/api/v1/businesses/${fx.businessId}/features`).set(bearer(fx.ownerToken));
    expect((await features(b)).body.data).toEqual({
      counterMode: false,
      welcomeStamp: false,
      stampExpiry: true,
    });
    // Alpha joined before the change and keeps what it signed up for.
    expect((await features(a)).body.data.counterMode).toBe(true);

    const lookup = await api()
      .post(`/api/v1/businesses/${b.businessId}/counter/lookup`)
      .set(bearer(b.ownerToken))
      .send({ code: "ABCDEFGH" });
    expect(lookup.status).toBe(403);
    expect(lookup.body.error.code).toBe("PLAN_FEATURE");

    const program = (body: object) =>
      api()
        .post(`/api/v1/businesses/${b.businessId}/programs`)
        .set(bearer(b.ownerToken))
        .send({ name: "Card", requiredStamps: 5, ...body });
    expect((await program({ welcomeStamp: true })).status).toBe(403);
    expect((await program({ stampExpiryDays: 30 })).status).toBe(201);
  });
});
