import { describe, expect, it } from "vitest";
import { Invoice, PaymentProof, Subscription } from "@/models";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { quotePlanChange } from "@/modules/billing/planQuote";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

const DAY = 86_400_000;
const USAGE = { branches: 1, programs: 1, stampers: 1, staff: 0, customers: 10 };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function onboard(rootToken: string, planCode: string) {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({
      business: { name: "Multan Mithai", category: "CAFE" },
      owner: { name: "Owner", email: "owner@example.com" },
      planCode,
    });
  const businessId = invite.body.data.business._id as string;
  const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
  const accepted = await api()
    .post(`/api/v1/invitations/${token}/accept`)
    .send({ password: PASSWORD });
  const ownerToken = accepted.body.data.accessToken as string;
  await enableMfa(ownerToken);
  return { businessId, ownerToken };
}

/** Paying customer, with this many days of the month left. */
async function paidUp(businessId: string, daysLeft: number) {
  const now = Date.now();
  await Subscription.updateOne(
    { businessId },
    {
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodStart: new Date(now - (30 - daysLeft) * DAY),
      currentPeriodEnd: new Date(now + daysLeft * DAY),
    },
  );
}

function changePlan(token: string, businessId: string, planCode: string, billingCycle?: string) {
  return api()
    .post(`/api/v1/businesses/${businessId}/billing/plan`)
    .set(bearer(token))
    .send({ planCode, billingCycle });
}

function addCharge(rootToken: string, businessId: string) {
  return api()
    .post(`/api/v1/admin/businesses/${businessId}/charges`)
    .set(bearer(rootToken))
    .send({ kind: "HARDWARE", description: "NFC stamper", quantity: 2, unitPkr: 1500 });
}

function issue(rootToken: string, businessId: string) {
  return api()
    .post(`/api/v1/admin/businesses/${businessId}/invoices`)
    .set(bearer(rootToken))
    .send({});
}

describe("plan change quotes", () => {
  const plan = (code: string, monthly: number, limits = {}) => ({
    code,
    priceMonthlyPkr: monthly,
    priceAnnualPkr: monthly * 10,
    limits,
  });
  const active = {
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    plan: plan("GROWTH", 8000),
    currentPeriodEnd: new Date(Date.now() + 15 * DAY),
  };

  it("refuses a plan too small for what the business runs, and warns about customers", () => {
    const quote = quotePlanChange(
      active,
      plan("STARTER", 3000, { branches: 0, customers: 5 }),
      "MONTHLY",
      USAGE,
    );
    expect(quote.kind).toBe("PERIOD_END");
    expect(quote.blockers).toEqual(["You have 1 branches; this plan allows 0."]);
    expect(quote.warnings[0]).toContain("new customers cannot join");
  });

  it("waits for the period end to change cycle, and sends annual upgrades to the team", () => {
    expect(quotePlanChange(active, active.plan, "ANNUAL", USAGE).kind).toBe("PERIOD_END");
    const annual = { ...active, billingCycle: "ANNUAL" };
    expect(quotePlanChange(annual, plan("PRO", 20000), "ANNUAL", USAGE).kind).toBe("CONTACT_TEAM");
  });
});

describe("owner plan changes", () => {
  it("applies a change at once and free during the trial, and updates the open invoice", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "STARTER");
    const first = (await issue(root.token, businessId)).body.data;

    const res = await changePlan(ownerToken, businessId, "GROWTH");
    expect(res.status).toBe(200);
    expect(res.body.data.quote).toMatchObject({ kind: "NOW", chargePkr: 0 });
    expect(res.body.data.subscription.plan.code).toBe("GROWTH");

    expect((await Invoice.findById(first._id))!.status).toBe("VOID");
    const open = await Invoice.findOne({ businessId, status: "ISSUED" });
    expect(open!.subtotalPkr).toBe(7999);
  });

  it("charges an upgrade for the days left on the next invoice, once", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "STARTER");
    await paidUp(businessId, 15);

    const res = await changePlan(ownerToken, businessId, "GROWTH");
    expect(res.body.data.quote.kind).toBe("PRORATED");
    expect(res.body.data.quote.chargePkr).toBe(2464); // 5,000 × 15 / 30.44
    expect(res.body.data.subscription.plan.code).toBe("GROWTH");

    const again = await changePlan(ownerToken, businessId, "GROWTH");
    expect(again.status).toBe(400);
    expect((await Subscription.findOne({ businessId }))!.pendingCharges).toHaveLength(1);

    const invoice = (await issue(root.token, businessId)).body.data;
    expect(invoice.lines).toHaveLength(2);
    expect(invoice.subtotalPkr).toBe(7999 + 2464);
    expect((await Subscription.findOne({ businessId }))!.pendingCharges).toHaveLength(0);
  });

  it("schedules a downgrade, bills the renewal at the new price and applies it at period end", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "GROWTH");
    await paidUp(businessId, 5);

    const res = await changePlan(ownerToken, businessId, "STARTER");
    expect(res.body.data.quote.kind).toBe("PERIOD_END");
    expect(res.body.data.subscription.plan.code).toBe("GROWTH");

    await runSubscriptionJob();
    const invoice = await Invoice.findOne({ businessId, status: "ISSUED" });
    expect(invoice!.subtotalPkr).toBe(2999);
    expect(invoice!.planCode).toBe("STARTER");
    expect((await Subscription.findOne({ businessId }))!.plan.code).toBe("GROWTH");

    const result = await runSubscriptionJob(new Date(Date.now() + 6 * DAY));
    expect(result.planChanged).toBe(1);
    const sub = await Subscription.findOne({ businessId });
    expect(sub!.plan.code).toBe("STARTER");
    expect(sub!.scheduledChange).toBeNull();
  });

  it("lets the owner cancel a scheduled change, which restores the invoice price", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "GROWTH");
    await paidUp(businessId, 5);
    await changePlan(ownerToken, businessId, "STARTER");
    await runSubscriptionJob();

    const res = await api()
      .delete(`/api/v1/businesses/${businessId}/billing/scheduled-change`)
      .set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect((await Invoice.findOne({ businessId, status: "ISSUED" }))!.subtotalPkr).toBe(7999);
  });

  it("refuses a change while a receipt is under review", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "STARTER");
    const invoice = (await issue(root.token, businessId)).body.data;
    await api()
      .post(`/api/v1/businesses/${businessId}/invoices/${invoice._id}/proofs`)
      .set(bearer(ownerToken))
      .field("method", "RAAST")
      .field("amountPkr", String(invoice.totalPkr))
      .attach("file", PNG, "receipt.png");
    expect(await PaymentProof.countDocuments({ businessId })).toBe(1);

    const res = await changePlan(ownerToken, businessId, "GROWTH");
    expect(res.status).toBe(409);
    expect((await Invoice.findById(invoice._id))!.status).toBe("ISSUED");
  });

  it("keeps hidden plans away from owners", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "STARTER");
    expect((await changePlan(ownerToken, businessId, "ENTERPRISE")).status).toBe(404);
  });
});

describe("charges", () => {
  it("puts hardware on the open invoice, undiscounted, and returns it if the invoice is voided", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "STARTER");
    await api()
      .patch(`/api/v1/admin/businesses/${businessId}/subscription/discount`)
      .set(bearer(root.token))
      .send({ discountPercent: 100 });
    await Subscription.updateOne({ businessId }, { discountPercent: 50 });
    await issue(root.token, businessId);

    expect((await addCharge(root.token, businessId)).status).toBe(201);
    const open = await Invoice.findOne({ businessId, status: "ISSUED" });
    expect(open!.subtotalPkr).toBe(2999 + 3000);
    expect(open!.discountPkr).toBe(1500); // half of the plan only

    await api()
      .post(`/api/v1/admin/invoices/${open!._id}/void`)
      .set(bearer(root.token))
      .send({ reason: "Wrong month" });
    const sub = await Subscription.findOne({ businessId });
    expect(sub!.pendingCharges).toHaveLength(1);
    expect(sub!.pendingCharges[0]!.amountPkr).toBe(3000);
  });

  it("removes a charge not yet invoiced, and only for the team", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token, "STARTER");
    const added = await addCharge(root.token, businessId);
    const chargeId = added.body.data.pendingCharges[0]._id;
    expect((await addCharge(ownerToken, businessId)).status).toBe(403);

    const res = await api()
      .delete(`/api/v1/admin/businesses/${businessId}/charges/${chargeId}`)
      .set(bearer(root.token));
    expect(res.status).toBe(200);
    expect(res.body.data.pendingCharges).toHaveLength(0);
  });
});

describe("finance metrics", () => {
  it("reports churn, trial conversion and revenue by plan", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "STARTER");
    await paidUp(businessId, 10);
    await Subscription.updateOne({ businessId }, { trialEndsAt: new Date(Date.now() - DAY) });

    const res = await api().get("/api/v1/admin/billing/overview").set(bearer(root.token));
    expect(res.body.data.mrrByPlan).toEqual([{ plan: "Starter", businesses: 1, mrrPkr: 2999 }]);
    expect(res.body.data.churnPercent).toBe(0);
    expect(res.body.data.trialConversionPercent).toBe(100);
  });
});
