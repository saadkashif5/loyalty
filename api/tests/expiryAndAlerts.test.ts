import { describe, expect, it } from "vitest";
import {
  Business,
  FraudFlag,
  LoyaltyCard,
  NfcDevice,
  Notification,
  Stamp,
  Subscription,
} from "@/models";
import { createBusiness } from "@/modules/businesses/businesses.service";
import { runStampExpiryJob } from "@/jobs/stampExpiry.job";
import { isOutsideOpeningHours } from "@/services/fraud.service";
import { testOutbox } from "@/services/email.service";
import { BUSINESS_STATUS } from "@taptapsell/constants";
import { PASSWORD, api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

const DAY = 86_400_000;
let counter = 0;

async function setup() {
  counter = 0;
  const owner = await registerUser("owner@example.com");
  const business = await createBusiness(owner.userId, { name: "Chai Wala Cafe", category: "CAFE" });
  const businessId = business._id.toString();
  await Business.updateOne({ _id: businessId }, { status: BUSINESS_STATUS.ACTIVE });
  await enableMfa(owner.token);
  const as = (path: string) => `/api/v1/businesses/${businessId}${path}`;

  const branch = await api()
    .post(as("/branches"))
    .set(bearer(owner.token))
    .send({ name: "Gulberg" });
  const branchId = branch.body.data._id as string;
  const program = await api().post(as("/programs")).set(bearer(owner.token)).send({
    name: "Chai Card",
    requiredStamps: 5,
    minMinutesBetweenStamps: 0,
    stampExpiryDays: 30,
  });
  expect(program.status).toBe(201);
  const programId = program.body.data._id as string;
  const device = await NfcDevice.create({
    deviceIdentifier: "TAP123",
    businessId,
    branchId,
    status: "ACTIVE",
  });
  return { owner, businessId, branchId, programId, device, as };
}

async function joinAndStamp(token: string, programId: string, key: string) {
  await api().post("/api/v1/loyalty-cards/join").set(bearer(token)).send({ programId });
  return stampOnce(token, key);
}

async function stampOnce(token: string, key: string) {
  counter += 1;
  const m = `04A1B2C3D4E5F6x${counter.toString(16).toUpperCase().padStart(6, "0")}`;
  const tap = await api().post("/api/v1/taps").send({ deviceIdentifier: "TAP123", params: { m } });
  return api()
    .post("/api/v1/stamps")
    .set(bearer(token))
    .set("Idempotency-Key", `stamp-key-${key}`)
    .send({ tapToken: tap.body.data.tapToken });
}

const settle = () => new Promise((r) => setTimeout(r, 100));

describe("stamp expiry", () => {
  it("empties a card left too long, on the card page and when stamping again", async () => {
    const fx = await setup();
    const customer = await registerUser("ayesha@example.com");
    const first = await joinAndStamp(customer.token, fx.programId, "s1");
    expect(first.status).toBe(201);
    const card = await LoyaltyCard.findOne();

    const view = async () =>
      (await api().get(`/api/v1/loyalty-cards/${card!.id}`).set(bearer(customer.token))).body.data
        .card;
    const fresh = await view();
    expect(fresh.stampsExpireAt).toBeTruthy();
    expect(fresh.stampExpiryDays).toBe(30);
    expect(fresh.programId.settings).toBeUndefined();

    await LoyaltyCard.updateOne(
      { _id: card!._id },
      { lastStampAt: new Date(Date.now() - 31 * DAY) },
    );
    const lapsed = await view();
    expect(lapsed.stampCount).toBe(0);
    expect(lapsed.lastExpiry.stamps).toBe(1);

    // Stamping after a lapse starts a new card at one.
    await LoyaltyCard.updateOne(
      { _id: card!._id },
      { stampCount: 3, lastStampAt: new Date(Date.now() - 40 * DAY) },
    );
    const again = await stampOnce(customer.token, "s2");
    expect(again.body.data.card.stampCount).toBe(1);
  });

  it("warns a week before, once, then expires and tells the customer", async () => {
    const fx = await setup();
    const customer = await registerUser("ayesha@example.com");
    await joinAndStamp(customer.token, fx.programId, "s1");
    const card = await LoyaltyCard.findOne();

    await LoyaltyCard.updateOne(
      { _id: card!._id },
      { lastStampAt: new Date(Date.now() - 25 * DAY) },
    );
    expect(await runStampExpiryJob()).toEqual({ warned: 1, expired: 0 });
    expect(await runStampExpiryJob()).toEqual({ warned: 0, expired: 0 });
    expect(await Notification.exists({ type: "STAMPS_EXPIRING" })).toBeTruthy();
    expect(testOutbox().some((m) => /expire on/.test(m.subject))).toBe(true);

    await LoyaltyCard.updateOne(
      { _id: card!._id },
      { lastStampAt: new Date(Date.now() - 31 * DAY) },
    );
    expect(await runStampExpiryJob()).toEqual({ warned: 0, expired: 1 });
    expect((await LoyaltyCard.findById(card!._id))!.stampCount).toBe(0);
    expect(await Notification.exists({ type: "STAMPS_EXPIRED" })).toBeTruthy();
  });

  it("leaves programs without expiry alone", async () => {
    const fx = await setup();
    await api()
      .patch(fx.as(`/programs/${fx.programId}`))
      .set(bearer(fx.owner.token))
      .send({ stampExpiryDays: null });
    const customer = await registerUser("ayesha@example.com");
    await joinAndStamp(customer.token, fx.programId, "s1");
    await LoyaltyCard.updateMany({}, { lastStampAt: new Date(Date.now() - 400 * DAY) });
    expect(await runStampExpiryJob()).toEqual({ warned: 0, expired: 0 });
  });
});

describe("opening hours", () => {
  // Monday 09:00–22:00 and Saturday 18:00–02:00, Pakistan time (UTC+5).
  const hours = [
    { day: 1, open: "09:00", close: "22:00" },
    { day: 6, open: "18:00", close: "02:00" },
  ];
  const pkt = (iso: string) => new Date(`${iso}+05:00`);

  it("knows when a branch is closed, with grace and past midnight", () => {
    expect(isOutsideOpeningHours(hours, pkt("2026-11-02T12:00:00"))).toBe(false); // Monday noon
    expect(isOutsideOpeningHours(hours, pkt("2026-11-02T22:20:00"))).toBe(false); // grace
    expect(isOutsideOpeningHours(hours, pkt("2026-11-02T23:00:00"))).toBe(true);
    expect(isOutsideOpeningHours(hours, pkt("2026-11-03T12:00:00"))).toBe(true); // Tuesday
    expect(isOutsideOpeningHours(hours, pkt("2026-11-08T01:00:00"))).toBe(false); // Sat night → Sun
    expect(isOutsideOpeningHours(hours, pkt("2026-11-08T03:00:00"))).toBe(true);
    expect(isOutsideOpeningHours([], pkt("2026-11-08T03:00:00"))).toBe(false);
  });

  it("raises an alert for a stamp while the branch is closed", async () => {
    const fx = await setup();
    const bad = await api()
      .patch(fx.as(`/branches/${fx.branchId}`))
      .set(bearer(fx.owner.token))
      .send({ openingHours: [{ day: 1, open: "9am", close: "22:00" }] });
    expect(bad.status).toBe(400);

    // Open one hour a day, twelve hours from now: the stamp is outside.
    const local = new Date(Date.now() + 5 * 3_600_000 + 12 * 3_600_000);
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const close = String((local.getUTCHours() + 1) % 24).padStart(2, "0");
    const week = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      open: `${hh}:00`,
      close: `${close}:00`,
    }));
    const saved = await api()
      .patch(fx.as(`/branches/${fx.branchId}`))
      .set(bearer(fx.owner.token))
      .send({ openingHours: week });
    expect(saved.status).toBe(200);

    const customer = await registerUser("ayesha@example.com");
    await joinAndStamp(customer.token, fx.programId, "s1");
    await settle();
    const flag = await FraudFlag.findOne({ type: "OUTSIDE_HOURS" });
    expect(flag!.message).toContain("Gulberg");
  });
});

describe("new account burst", () => {
  it("flags many brand-new accounts getting a first stamp at one stamper", async () => {
    const fx = await setup();
    await Stamp.insertMany(
      Array.from({ length: 9 }, (_, i) => ({
        businessId: fx.businessId,
        branchId: fx.branchId,
        programId: fx.programId,
        loyaltyCardId: fx.device._id,
        customerId: fx.device._id,
        deviceId: fx.device._id,
        source: "NFC",
        idempotencyKey: `seed-${i}`,
        metadata: { newCustomer: true },
      })),
    );
    const customer = await registerUser("fresh@example.com");
    await joinAndStamp(customer.token, fx.programId, "s1");
    await settle();
    expect((await Stamp.findOne({ idempotencyKey: "stamp-key-s1" }))!.metadata).toMatchObject({
      newCustomer: true,
    });
    const flag = await FraudFlag.findOne({ type: "NEW_ACCOUNT_BURST" });
    expect(flag!.severity).toBe("HIGH");
  });
});

describe("finance: reminders and revenue by city", () => {
  async function onboard(rootToken: string, city: string) {
    const invite = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(rootToken))
      .send({
        business: { name: `Cafe ${city}`, category: "CAFE", contact: { city } },
        owner: { name: "Owner", email: `owner-${city.toLowerCase()}@example.com` },
      });
    const businessId = invite.body.data.business._id as string;
    const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
    await api().post(`/api/v1/invitations/${token}/accept`).send({ password: PASSWORD });
    return businessId;
  }

  it("sends one reminder a day to an overdue business", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const businessId = await onboard(root.token, "Lahore");
    const remind = () =>
      api().post(`/api/v1/admin/businesses/${businessId}/billing/remind`).set(bearer(root.token));

    expect((await remind()).status).toBe(400); // still on trial

    await Subscription.updateOne(
      { businessId },
      { status: "PAST_DUE", graceEndsAt: new Date(Date.now() + 3 * DAY) },
    );
    expect((await remind()).status).toBe(200);
    expect(
      testOutbox().some((m) => m.to === "owner-lahore@example.com" && /Reminder/.test(m.subject)),
    ).toBe(true);
    expect((await remind()).status).toBe(409);

    const support = await platformUser("help@example.com", "SUPPORT");
    const refused = await api()
      .post(`/api/v1/admin/businesses/${businessId}/billing/remind`)
      .set(bearer(support.token));
    expect(refused.status).toBe(403);
  });

  it("breaks recurring revenue down by city", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const lahore = await onboard(root.token, "Lahore");
    await onboard(root.token, "Karachi");
    await Subscription.updateMany({}, { status: "ACTIVE" });
    await Business.updateOne({ _id: lahore }, { "contact.city": "lahore " });

    const overview = await api().get("/api/v1/admin/billing/overview").set(bearer(root.token));
    const cities = overview.body.data.mrrByCity.map((r: { city: string }) => r.city).sort();
    expect(cities).toEqual(["Karachi", "lahore"]);
  });
});
