import { describe, expect, it } from "vitest";
import { Business, NfcDevice, Plan, Redemption, Subscription } from "@/models";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { addPeriods } from "@/modules/billing/billing.config";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

const DAY = 86_400_000;

/** A business invited by the platform and accepted by its owner, on the given plan. */
async function onboard(rootToken: string, planCode = "STARTER", email = "owner@example.com") {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({
      business: { name: "Hyderabad Halwa", category: "BAKERY" },
      owner: { name: "Owner", email },
      planCode,
    });
  expect(invite.status).toBe(201);
  const businessId = invite.body.data.business._id as string;
  const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];

  const accepted = await api()
    .post(`/api/v1/invitations/${token}/accept`)
    .send({ password: PASSWORD });
  const ownerToken = accepted.body.data.accessToken as string;
  await enableMfa(ownerToken);
  return { businessId, ownerToken };
}

function addBranch(ownerToken: string, businessId: string, name: string) {
  return api()
    .post(`/api/v1/businesses/${businessId}/branches`)
    .set(bearer(ownerToken))
    .send({ name });
}

/** Moves the subscription's clock instead of waiting days. */
async function shiftDates(businessId: string, set: Record<string, Date | null>) {
  await Subscription.updateOne({ businessId }, { $set: set });
}

describe("plans and subscriptions", () => {
  it("starts a trial on the chosen plan when the owner accepts", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const invite = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(root.token))
      .send({
        business: { name: "Trial Cafe", category: "CAFE" },
        owner: { name: "O", email: "trial@example.com" },
      });
    const businessId = invite.body.data.business._id;

    const before = await Subscription.findOne({ businessId });
    expect(before!.status).toBe("TRIALING");
    expect(before!.plan.code).toBe("STARTER");
    expect(before!.trialEndsAt).toBeNull();

    const token = invite.body.data.inviteUrl.split("/invite/")[1];
    await api().post(`/api/v1/invitations/${token}/accept`).send({ password: PASSWORD });

    const after = await Subscription.findOne({ businessId });
    const days = (after!.trialEndsAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("enforces plan limits and lifts them on upgrade", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token);

    expect((await addBranch(ownerToken, businessId, "First")).status).toBe(201);
    const second = await addBranch(ownerToken, businessId, "Second");
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe("PLAN_LIMIT");
    expect(second.body.error.message).toContain("Starter plan allows 1 branch");

    await api()
      .patch(`/api/v1/admin/businesses/${businessId}/subscription`)
      .set(bearer(root.token))
      .send({ planCode: "GROWTH" });
    expect((await addBranch(ownerToken, businessId, "Second")).status).toBe(201);
  });

  it("stops new customers joining at the customer limit, with a customer-friendly message", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await api()
      .post("/api/v1/admin/plans")
      .set(bearer(root.token))
      .send({
        code: "TINY",
        name: "Tiny",
        priceMonthlyPkr: 500,
        priceAnnualPkr: 5000,
        limits: { branches: 1, programs: 1, stampers: 1, staff: 1, customers: 1 },
      });
    const { businessId, ownerToken } = await onboard(root.token, "TINY");
    const program = await api()
      .post(`/api/v1/businesses/${businessId}/programs`)
      .set(bearer(ownerToken))
      .send({ name: "Halwa Card", requiredStamps: 5 });

    const join = async (email: string) => {
      const reg = await api()
        .post("/api/v1/auth/register")
        .send({ name: "C", email, password: PASSWORD });
      return api()
        .post("/api/v1/loyalty-cards/join")
        .set(bearer(reg.body.data.accessToken))
        .send({ programId: program.body.data._id });
    };

    expect((await join("first@example.com")).status).toBe(201);
    const second = await join("second@example.com");
    expect(second.status).toBe(403);
    expect(second.body.error.message).toContain("not taking new loyalty members");
  });

  it("runs unpaid → past due → suspended, keeps rewards redeemable, and restores on payment", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token);
    const branch = await addBranch(ownerToken, businessId, "Main");
    await NfcDevice.create({
      deviceIdentifier: "HYD001",
      businessId,
      branchId: branch.body.data._id,
      status: "ACTIVE",
    });
    const redemption = await Redemption.create({
      rewardId: branch.body.data._id, // any id; only the code matters here
      customerId: branch.body.data._id,
      loyaltyCardId: branch.body.data._id,
      businessId,
      redemptionCode: "HALWA234",
    });

    // Trial ends.
    await shiftDates(businessId, { trialEndsAt: new Date(Date.now() - 1000) });
    expect((await runSubscriptionJob()).pastDue).toBe(1);
    expect((await Subscription.findOne({ businessId }))!.status).toBe("PAST_DUE");
    expect(testOutbox().some((m) => m.subject.includes("payment is due"))).toBe(true);

    // Grace ends.
    await shiftDates(businessId, { graceEndsAt: new Date(Date.now() - 1000) });
    expect((await runSubscriptionJob()).suspended).toBe(1);
    const suspended = await Business.findById(businessId);
    expect(suspended!.status).toBe("SUSPENDED");
    expect(suspended!.suspension?.kind).toBe("BILLING");
    expect((await NfcDevice.findOne({ deviceIdentifier: "HYD001" }))!.status).toBe("SUSPENDED");

    // Changes are blocked, but earned rewards can still be redeemed.
    expect((await addBranch(ownerToken, businessId, "Blocked")).body.error.code).toBe(
      "BUSINESS_SUSPENDED",
    );
    const redeem = await api()
      .post(`/api/v1/businesses/${businessId}/redemptions/validate`)
      .set(bearer(ownerToken))
      .send({ redemptionCode: redemption.redemptionCode });
    expect(redeem.status).toBe(200);

    // Payment switches everything back on.
    const paid = await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(root.token))
      .send({ amountPkr: 2999, method: "BANK_TRANSFER", reference: "IBFT-123" });
    expect(paid.status).toBe(201);

    const sub = await Subscription.findOne({ businessId });
    expect(sub!.status).toBe("ACTIVE");
    const months = (sub!.currentPeriodEnd!.getTime() - Date.now()) / DAY;
    expect(months).toBeGreaterThan(27);
    expect((await Business.findById(businessId))!.status).toBe("ACTIVE");
    expect((await NfcDevice.findOne({ deviceIdentifier: "HYD001" }))!.status).toBe("ACTIVE");
    expect(testOutbox().some((m) => m.subject.includes("Payment received"))).toBe(true);
  });

  it("does not lift a suspension the team made when a payment arrives", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token);
    await api()
      .patch(`/api/v1/admin/businesses/${businessId}/status`)
      .set(bearer(root.token))
      .send({ status: "SUSPENDED", reason: "Terms violation" });

    await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(root.token))
      .send({ amountPkr: 2999, method: "CASH" });
    expect((await Business.findById(businessId))!.status).toBe("SUSPENDED");
  });

  it("adds paid time after the remaining trial, so paying early loses nothing", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token);
    const trialEnd = (await Subscription.findOne({ businessId }))!.trialEndsAt!;

    await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(root.token))
      .send({ amountPkr: 2999, method: "RAAST", periods: 2 });

    const sub = await Subscription.findOne({ businessId });
    expect(sub!.currentPeriodEnd!.getTime()).toBe(addPeriods(trialEnd, "MONTHLY", 2).getTime());
  });

  it("revives an expired trial when the team extends it", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token);
    await shiftDates(businessId, { trialEndsAt: new Date(Date.now() - 1000) });
    await runSubscriptionJob();

    const res = await api()
      .post(`/api/v1/admin/businesses/${businessId}/subscription/extend-trial`)
      .set(bearer(root.token))
      .send({ days: 14 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("TRIALING");
  });

  it("reminds owners once before the trial ends", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "STARTER", "remind@example.com");
    await shiftDates(businessId, { trialEndsAt: new Date(Date.now() + 2 * DAY) });

    expect((await runSubscriptionJob()).reminded).toBe(1);
    expect((await runSubscriptionJob()).reminded).toBe(0);
    expect(
      testOutbox().some((m) => m.to === "remind@example.com" && m.subject.includes("trial ends")),
    ).toBe(true);
  });

  it("reports revenue, and keeps payments to billing roles", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const admin = await platformUser("ops@example.com", "ADMIN");
    const finance = await platformUser("money@example.com", "FINANCE");
    const { businessId } = await onboard(root.token);

    const byAdmin = await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(admin.token))
      .send({ amountPkr: 2999, method: "CASH" });
    expect(byAdmin.status).toBe(403);

    await api()
      .post(`/api/v1/admin/businesses/${businessId}/payments`)
      .set(bearer(finance.token))
      .send({ amountPkr: 2999, method: "CASH" });

    const overview = await api().get("/api/v1/admin/billing/overview").set(bearer(admin.token));
    expect(overview.body.data.mrrPkr).toBe(2999);
    expect(overview.body.data.counts.ACTIVE).toBe(1);
    expect(overview.body.data.collectedThisMonthPkr).toBe(2999);
  });

  it("keeps existing businesses on their price when a plan changes", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token);
    const starter = await Plan.findOne({ code: "STARTER" });

    const edited = await api()
      .patch(`/api/v1/admin/plans/${starter!._id}`)
      .set(bearer(root.token))
      .send({ priceMonthlyPkr: 3999 });
    expect(edited.body.data.version).toBe(2);

    const billing = await api()
      .get(`/api/v1/businesses/${businessId}/billing`)
      .set(bearer(ownerToken));
    expect(billing.body.data.subscription.plan.priceMonthlyPkr).toBe(2999);
    expect(billing.body.data.nextPaymentPkr).toBe(2999);
    expect(billing.body.data.usage).toMatchObject({ branches: 0, staff: 0 });
  });

  it("adds months without spilling into the next one", () => {
    expect(addPeriods(new Date("2027-01-31T10:00:00Z"), "MONTHLY", 1).toISOString()).toBe(
      "2027-02-28T10:00:00.000Z",
    );
    expect(addPeriods(new Date("2026-11-15T10:00:00Z"), "ANNUAL", 1).toISOString()).toBe(
      "2027-11-15T10:00:00.000Z",
    );
  });
});
