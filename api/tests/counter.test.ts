import { beforeEach, describe, expect, it } from "vitest";
import {
  Business,
  BusinessMember,
  CounterCode,
  FraudFlag,
  NfcDevice,
  Redemption,
  Stamp,
} from "@/models";
import { createBusiness } from "@/modules/businesses/businesses.service";
import { startOfPakistanDay } from "@/modules/stamps/stamps.service";
import { checkDeviceBurst } from "@/services/fraud.service";
import { runRewardExpiryJob } from "@/jobs/rewardExpiry.job";
import { testOutbox } from "@/services/email.service";
import { api, bearer, enableMfa, registerUser } from "./helpers";

interface Fixture {
  owner: string;
  staff: string;
  businessId: string;
  branchId: string;
  programId: string;
}

async function setUp(): Promise<Fixture> {
  const owner = await registerUser("owner@example.com", "Owner");
  const business = await createBusiness(owner.userId, { name: "Peshawar Kahwa", category: "CAFE" });
  const businessId = business._id.toString();
  await Business.updateOne({ _id: businessId }, { status: "ACTIVE" });
  await enableMfa(owner.token);

  const b = `/api/v1/businesses/${businessId}`;
  const branchId = (
    await api().post(`${b}/branches`).set(bearer(owner.token)).send({ name: "Saddar" })
  ).body.data._id as string;
  const programId = (
    await api()
      .post(`${b}/programs`)
      .set(bearer(owner.token))
      .send({ name: "Kahwa Card", requiredStamps: 4, minMinutesBetweenStamps: 0 })
  ).body.data._id as string;
  await api()
    .post(`${b}/rewards`)
    .set(bearer(owner.token))
    .send({ programId, name: "Free Kahwa", type: "FREE_ITEM", requiredStamps: 4, validForDays: 7 });

  const staff = await registerUser("cashier@example.com", "Cashier");
  await BusinessMember.create({
    userId: staff.userId,
    businessId,
    role: "STAFF",
    status: "ACTIVE",
  });

  return { owner: owner.token, staff: staff.token, businessId, branchId, programId };
}

describe("counter mode, limits and alerts", () => {
  let fx: Fixture;
  const path = (p: string) => `/api/v1/businesses/${fx.businessId}${p}`;

  async function customerWithCard(email: string) {
    const customer = await registerUser(email);
    const card = await api()
      .post("/api/v1/loyalty-cards/join")
      .set(bearer(customer.token))
      .send({ programId: fx.programId });
    return { token: customer.token, cardId: card.body.data._id as string };
  }

  async function codeFor(customer: { token: string; cardId: string }) {
    const res = await api()
      .post(`/api/v1/loyalty-cards/${customer.cardId}/counter-code`)
      .set(bearer(customer.token));
    return res.body.data.code as string;
  }

  function counterStamp(token: string, code: string, key: string) {
    return api()
      .post(path("/counter/stamp"))
      .set(bearer(token))
      .set("Idempotency-Key", key)
      .send({ code, branchId: fx.branchId });
  }

  beforeEach(async () => {
    fx = await setUp();
  });

  it("lets staff stamp a customer who shows their card code, once", async () => {
    const customer = await customerWithCard("ali@example.com");
    const code = await codeFor(customer);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    // The card keeps showing the same code while it is fresh.
    expect(await codeFor(customer)).toBe(code);

    const lookup = await api().post(path("/counter/lookup")).set(bearer(fx.staff)).send({ code });
    expect(lookup.body.data.card).toMatchObject({ program: "Kahwa Card", stampCount: 0 });

    const stamped = await counterStamp(fx.staff, code.toLowerCase(), "counter-key-1");
    expect(stamped.status).toBe(201);
    expect(stamped.body.data.card.stampCount).toBe(1);

    const stamp = await Stamp.findById(stamped.body.data.stampId);
    expect(stamp!.source).toBe("STAFF");
    expect(stamp!.issuedBy).toBeDefined();

    // A retry returns the same stamp; the code itself does not work again.
    expect((await counterStamp(fx.staff, code, "counter-key-1")).body.data.alreadyRecorded).toBe(
      true,
    );
    const reuse = await counterStamp(fx.staff, code, "counter-key-2");
    expect(reuse.body.error.code).toBe("COUNTER_CODE_INVALID");
  });

  it("refuses expired codes, and codes for another business", async () => {
    const customer = await customerWithCard("old@example.com");
    const code = await codeFor(customer);
    await CounterCode.updateOne({ code }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await counterStamp(fx.staff, code, "expired-key-1")).body.error.code).toBe(
      "COUNTER_CODE_INVALID",
    );

    const other = await registerUser("other-owner@example.com");
    const otherBusiness = await createBusiness(other.userId, {
      name: "Elsewhere",
      category: "CAFE",
    });
    await Business.updateOne({ _id: otherBusiness._id }, { status: "ACTIVE" });
    await enableMfa(other.token);
    const fresh = await codeFor(await customerWithCard("fresh@example.com"));
    const elsewhere = await api()
      .post(`/api/v1/businesses/${otherBusiness._id}/counter/lookup`)
      .set(bearer(other.token))
      .send({ code: fresh });
    expect(elsewhere.status).toBe(404);
  });

  it("keeps stamping by search to managers and owners", async () => {
    const customer = await customerWithCard("search@example.com");
    const res = await api()
      .post(path("/stamps/manual"))
      .set(bearer(fx.staff))
      .set("Idempotency-Key", "manual-by-staff")
      .send({ loyaltyCardId: customer.cardId, branchId: fx.branchId });
    expect(res.status).toBe(403);
  });

  it("caps the stamps one card can get in a day", async () => {
    await api()
      .patch(path(`/programs/${fx.programId}`))
      .set(bearer(fx.owner))
      .send({ maxStampsPerDay: 2 });
    const customer = await customerWithCard("daily@example.com");

    for (const key of ["daily-key-1", "daily-key-2"]) {
      expect((await counterStamp(fx.staff, await codeFor(customer), key)).status).toBe(201);
    }
    const third = await counterStamp(fx.staff, await codeFor(customer), "daily-key-3");
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("DAILY_STAMP_LIMIT");
  });

  it("caps each staff member's stamps per day and raises an alert", async () => {
    await api()
      .patch(`/api/v1/businesses/${fx.businessId}`)
      .set(bearer(fx.owner))
      .send({ staffDailyStampCap: 1 });

    const first = await customerWithCard("one@example.com");
    const second = await customerWithCard("two@example.com");
    expect((await counterStamp(fx.staff, await codeFor(first), "staff-cap-1")).status).toBe(201);

    const over = await counterStamp(fx.staff, await codeFor(second), "staff-cap-2");
    expect(over.body.error.code).toBe("STAFF_DAILY_LIMIT");

    const alerts = await api().get(path("/fraud-flags")).set(bearer(fx.owner));
    expect(alerts.body.data.map((f: { type: string }) => f.type)).toContain("STAFF_DAILY_CAP");
  });

  it("holds staff stamps past the approval threshold for a manager", async () => {
    await api()
      .patch(`/api/v1/businesses/${fx.businessId}`)
      .set(bearer(fx.owner))
      .send({ stampApprovalAfter: 1 });

    const first = await customerWithCard("one@example.com");
    const second = await customerWithCard("two@example.com");
    const third = await customerWithCard("three@example.com");
    expect((await counterStamp(fx.staff, await codeFor(first), "approve-1")).status).toBe(201);

    // The second one of the day waits; its code is spent meanwhile.
    const secondCode = await codeFor(second);
    const held = await counterStamp(fx.staff, secondCode, "approve-2");
    expect(held.status).toBe(202);
    expect(held.body.data.pendingApproval).toBe(true);
    expect((await counterStamp(fx.staff, secondCode, "approve-2")).body.data.requestId).toBe(
      held.body.data.requestId,
    );
    expect((await counterStamp(fx.staff, secondCode, "approve-2b")).body.error.code).toBe(
      "COUNTER_CODE_INVALID",
    );
    expect(await Stamp.countDocuments()).toBe(1);

    // Staff cannot see or decide the queue; the owner can.
    expect((await api().get(path("/stamp-requests")).set(bearer(fx.staff))).status).toBe(403);
    const queue = await api().get(path("/stamp-requests")).set(bearer(fx.owner));
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0].requestedBy.name).toBe("Cashier");

    const approved = await api()
      .post(path(`/stamp-requests/${held.body.data.requestId}/approve`))
      .set(bearer(fx.owner));
    expect(approved.status).toBe(201);
    expect(approved.body.data.card.stampCount).toBe(1);
    const stamp = await Stamp.findById(approved.body.data.stampId);
    expect(String(stamp!.issuedBy)).toBe(
      String((await BusinessMember.findOne({ role: "STAFF" }))!.userId),
    );
    expect(
      (
        await api()
          .post(path(`/stamp-requests/${held.body.data.requestId}/approve`))
          .set(bearer(fx.owner))
      ).status,
    ).toBe(404);

    // Turned down: no stamp.
    const another = await counterStamp(fx.staff, await codeFor(third), "approve-3");
    const rejected = await api()
      .post(path(`/stamp-requests/${another.body.data.requestId}/reject`))
      .set(bearer(fx.owner))
      .send({ reason: "Customer was not there" });
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(await Stamp.countDocuments()).toBe(2);

    // Owners and managers are never held.
    const own = await customerWithCard("four@example.com");
    expect((await counterStamp(fx.owner, await codeFor(own), "approve-4")).status).toBe(201);
  });

  it("raises one alert for repeated replays, which the owner can review and staff cannot see", async () => {
    await NfcDevice.create({
      deviceIdentifier: "PESH01",
      businessId: fx.businessId,
      branchId: fx.branchId,
      status: "ACTIVE",
    });
    const tap = (m: string) =>
      api().post("/api/v1/taps").send({ deviceIdentifier: "PESH01", params: { m } });

    await tap("04AAAAAAAAAAAAx000005");
    await tap("04AAAAAAAAAAAAx000005");
    await tap("04AAAAAAAAAAAAx000004");

    const flags = await FraudFlag.find({ businessId: fx.businessId, type: "TAP_REPLAYED" });
    expect(flags).toHaveLength(1);
    expect(flags[0].occurrences).toBe(2);

    expect((await api().get(path("/fraud-flags")).set(bearer(fx.staff))).status).toBe(403);

    const reviewed = await api()
      .patch(path(`/fraud-flags/${flags[0]._id}`))
      .set(bearer(fx.owner))
      .send({ status: "DISMISSED", note: "Customer refreshed the page" });
    expect(reviewed.body.data.status).toBe("DISMISSED");
    expect((await api().get(path("/fraud-flags")).set(bearer(fx.owner))).body.data).toHaveLength(0);
  });

  it("flags a burst of stamps from one stamper", async () => {
    const device = await NfcDevice.create({
      deviceIdentifier: "BURST1",
      businessId: fx.businessId,
      branchId: fx.branchId,
      status: "ACTIVE",
    });
    const customer = await customerWithCard("burst@example.com");
    const base = {
      customerId: (await Stamp.db.model("LoyaltyCard").findById(customer.cardId))!.get(
        "customerId",
      ),
      loyaltyCardId: customer.cardId,
      programId: fx.programId,
      businessId: fx.businessId,
      branchId: fx.branchId,
      deviceId: device._id,
      source: "NFC",
    };
    await Stamp.insertMany(
      Array.from({ length: 40 }, (_, i) => ({ ...base, idempotencyKey: `burst-${i}` })),
    );

    await checkDeviceBurst(fx.businessId, device._id);
    const flag = await FraudFlag.findOne({ type: "DEVICE_BURST", deviceId: device._id });
    expect(flag?.severity).toBe("HIGH");
  });

  it("expires unused rewards, refuses them at the counter and reminds customers once", async () => {
    await api()
      .patch(path(`/programs/${fx.programId}`))
      .set(bearer(fx.owner))
      .send({ maxStampsPerDay: 10 });
    const customer = await customerWithCard("reward@example.com");
    for (let i = 0; i < 4; i += 1) {
      await counterStamp(fx.staff, await codeFor(customer), `reward-key-${i}`);
    }

    const redemption = await Redemption.findOne({ loyaltyCardId: customer.cardId });
    expect(redemption!.expiresAt).toBeInstanceOf(Date);

    // Two days left: one reminder, never two.
    await Redemption.updateOne(
      { _id: redemption!._id },
      { expiresAt: new Date(Date.now() + 2 * 86_400_000) },
    );
    expect((await runRewardExpiryJob()).reminded).toBe(1);
    expect((await runRewardExpiryJob()).reminded).toBe(0);
    expect(
      testOutbox().some(
        (m) => m.to === "reward@example.com" && m.subject.includes("Peshawar Kahwa"),
      ),
    ).toBe(true);

    // Past its date: refused at the counter.
    await Redemption.updateOne(
      { _id: redemption!._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    const late = await api()
      .post(path("/redemptions/validate"))
      .set(bearer(fx.staff))
      .send({ redemptionCode: redemption!.redemptionCode });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("REWARD_EXPIRED");
    expect((await Redemption.findById(redemption!._id))!.status).toBe("EXPIRED");
  });

  it("resets daily limits at midnight Pakistan time", () => {
    // 01:00 on 1 November in Pakistan is 20:00 on 31 October UTC.
    const start = startOfPakistanDay(Date.parse("2026-10-31T20:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-31T19:00:00.000Z");
  });
});
