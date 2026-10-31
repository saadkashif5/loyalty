import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { createApp } from "@/app";
import { AuditLog, Business, NfcDevice, User } from "@/models";
import { BUSINESS_STATUS } from "@taptapsell/constants";

const app = createApp();
const api = () => request(app);

async function registerUser(email: string) {
  const res = await api()
    .post("/api/v1/auth/register")
    .send({ name: "Test User", email, password: "correct-horse-battery" });

  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

interface Fixture {
  ownerToken: string;
  customerToken: string;
  customerId: string;
  businessId: string;
  branchId: string;
  programId: string;
  deviceIdentifier: string;
}

async function seedBusinessWithProgram(): Promise<Fixture> {
  const owner = await registerUser("owner@example.com");
  const customer = await registerUser("customer@example.com");

  const businessRes = await api()
    .post("/api/v1/businesses")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Chai Wala Cafe", category: "CAFE" });
  expect(businessRes.status).toBe(201);
  const businessId = businessRes.body.data._id as string;

  // Platform verification would normally do this; stamping requires an active business.
  await Business.updateOne({ _id: businessId }, { status: BUSINESS_STATUS.ACTIVE });

  const branchRes = await api()
    .post(`/api/v1/businesses/${businessId}/branches`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Gulberg Branch", address: "Lahore" });
  expect(branchRes.status).toBe(201);
  const branchId = branchRes.body.data._id as string;

  const programRes = await api()
    .post(`/api/v1/businesses/${businessId}/programs`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Coffee Rewards", requiredStamps: 3, minMinutesBetweenStamps: 0 });
  expect(programRes.status).toBe(201);
  const programId = programRes.body.data._id as string;

  const rewardRes = await api()
    .post(`/api/v1/businesses/${businessId}/rewards`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ programId, name: "Free Coffee", type: "FREE_ITEM", requiredStamps: 3 });
  expect(rewardRes.status).toBe(201);

  // Devices are minted platform-side; create one directly and activate it as the owner would.
  const device = await NfcDevice.create({
    deviceIdentifier: "TAP123",
    activationCode: "ACTIV8ME",
    businessId,
    branchId,
    status: "ASSIGNED",
  });

  const activateRes = await api()
    .post(`/api/v1/businesses/${businessId}/devices/activate`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ deviceIdentifier: device.deviceIdentifier, activationCode: "ACTIV8ME", branchId });
  expect(activateRes.status).toBe(200);

  return {
    ownerToken: owner.token,
    customerToken: customer.token,
    customerId: customer.userId,
    businessId,
    branchId,
    programId,
    deviceIdentifier: device.deviceIdentifier,
  };
}

// Stands in for an NTAG21x stamper: each read reports the chip UID and a
// counter that goes up by one, as `<UID>x<counter>` in the URL.
const TAG_UID = "04A1B2C3D4E5F6";
let tapCounter = 0;

function mirror(counter: number, uid = TAG_UID) {
  return `${uid}x${counter.toString(16).toUpperCase().padStart(6, "0")}`;
}

function tap(deviceIdentifier: string, m = mirror(++tapCounter)) {
  return api().post("/api/v1/taps").send({ deviceIdentifier, params: { m } });
}

function stampWithTap(token: string, tapToken: string, idempotencyKey: string) {
  return api()
    .post("/api/v1/stamps")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", idempotencyKey)
    .send({ tapToken });
}

/** One physical tap followed by the stamp request the portal makes with it. */
async function stamp(token: string, deviceIdentifier: string, idempotencyKey: string) {
  const tapRes = await tap(deviceIdentifier);
  if (tapRes.status !== 201) return tapRes;
  return stampWithTap(token, tapRes.body.data.tapToken, idempotencyKey);
}

function join(token: string, programId: string) {
  return api()
    .post("/api/v1/loyalty-cards/join")
    .set("Authorization", `Bearer ${token}`)
    .send({ programId });
}

describe("core loyalty loop", () => {
  let fx: Fixture;

  beforeEach(async () => {
    tapCounter = 0;
    fx = await seedBusinessWithProgram();
  });

  it("runs business setup -> join -> stamp -> reward unlock -> redemption", async () => {
    const joinRes = await api()
      .post("/api/v1/loyalty-cards/join")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ programId: fx.programId });
    expect(joinRes.status).toBe(201);

    const first = await stamp(fx.customerToken, fx.deviceIdentifier, "loop-key-1");
    expect(first.status).toBe(201);
    expect(first.body.data.card.stampCount).toBe(1);
    expect(first.body.data.unlockedReward).toBeNull();

    await stamp(fx.customerToken, fx.deviceIdentifier, "loop-key-2");
    const third = await stamp(fx.customerToken, fx.deviceIdentifier, "loop-key-3");

    expect(third.body.data.unlockedReward).not.toBeNull();
    // Progress resets so the card keeps working for the next cycle.
    expect(third.body.data.card.stampCount).toBe(0);

    const code = third.body.data.unlockedReward.redemptionCode as string;

    const validateRes = await api()
      .post(`/api/v1/businesses/${fx.businessId}/redemptions/validate`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ redemptionCode: code, branchId: fx.branchId });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.status).toBe("REDEEMED");

    // The same reward must not be redeemable twice (§17.1, acceptance criteria §49).
    const secondValidate = await api()
      .post(`/api/v1/businesses/${fx.businessId}/redemptions/validate`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ redemptionCode: code });
    expect(secondValidate.status).toBe(409);
  });

  it("treats a retried stamp request as the same stamp", async () => {
    await api()
      .post("/api/v1/loyalty-cards/join")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ programId: fx.programId });

    const tapRes = await tap(fx.deviceIdentifier);
    const first = await stampWithTap(fx.customerToken, tapRes.body.data.tapToken, "retry-key");
    const retry = await stampWithTap(fx.customerToken, tapRes.body.data.tapToken, "retry-key");

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.alreadyRecorded).toBe(true);
    expect(retry.body.data.card.stampCount).toBe(1);
  });

  it("rejects stamping before the customer has joined the program", async () => {
    const res = await stamp(fx.customerToken, fx.deviceIdentifier, "not-enrolled-key");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_ENROLLED");
  });

  it("rejects stamping on a revoked device", async () => {
    await api()
      .post("/api/v1/loyalty-cards/join")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ programId: fx.programId });

    const device = await NfcDevice.findOne({ deviceIdentifier: fx.deviceIdentifier });
    await api()
      .post(`/api/v1/businesses/${fx.businessId}/devices/${device!._id}/revoke`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ reason: "lost" });

    const res = await stamp(fx.customerToken, fx.deviceIdentifier, "revoked-key");
    expect(res.status).toBe(400);
  });

  it("enforces the cooldown between stamps on the same card", async () => {
    await api()
      .patch(`/api/v1/businesses/${fx.businessId}/programs/${fx.programId}`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ minMinutesBetweenStamps: 10 });

    await api()
      .post("/api/v1/loyalty-cards/join")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ programId: fx.programId });

    await stamp(fx.customerToken, fx.deviceIdentifier, "cooldown-1");
    const second = await stamp(fx.customerToken, fx.deviceIdentifier, "cooldown-2");

    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe("STAMP_COOLDOWN");
  });

  it("isolates businesses from each other", async () => {
    const outsider = await registerUser("outsider@example.com");

    const res = await api()
      .get(`/api/v1/businesses/${fx.businessId}/stamps`)
      .set("Authorization", `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it("does not let a customer reach a business dashboard route", async () => {
    const res = await api()
      .get(`/api/v1/businesses/${fx.businessId}/programs`)
      .set("Authorization", `Bearer ${fx.customerToken}`);

    expect(res.status).toBe(403);
  });

  it("requires an idempotency key on stamp requests", async () => {
    const res = await api()
      .post("/api/v1/stamps")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ deviceIdentifier: fx.deviceIdentifier, source: "NFC" });

    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated stamp requests", async () => {
    const res = await api()
      .post("/api/v1/stamps")
      .set("Idempotency-Key", "no-auth-key")
      .send({ deviceIdentifier: fx.deviceIdentifier, source: "NFC" });

    expect(res.status).toBe(401);
  });

  it("stores no plaintext password", async () => {
    const user = await User.findOne({ email: "customer@example.com" }).select("+passwordHash");
    expect(user!.passwordHash).not.toContain("correct-horse-battery");
    expect(user!.passwordHash.startsWith("$2")).toBe(true);
  });
  it("returns the business and its programs for the tap landing page", async () => {
    const res = await tap(fx.deviceIdentifier);

    expect(res.status).toBe(201);
    expect(res.body.data.tapToken).toEqual(expect.any(String));
    expect(res.body.data.business.name).toBe("Chai Wala Cafe");
    expect(res.body.data.programs[0].name).toBe("Coffee Rewards");
  });

  it("rejects a replayed stamper URL", async () => {
    const m = mirror(5);
    expect((await tap(fx.deviceIdentifier, m)).status).toBe(201);

    const replay = await tap(fx.deviceIdentifier, m);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("TAP_REPLAYED");

    const older = await tap(fx.deviceIdentifier, mirror(4));
    expect(older.status).toBe(409);
  });

  it("rejects a tap from a different chip once the stamper is bound", async () => {
    expect((await tap(fx.deviceIdentifier, mirror(1))).status).toBe(201);

    const other = await tap(fx.deviceIdentifier, mirror(2, "04FFFFFFFFFFFF"));
    expect(other.status).toBe(400);
    expect(other.body.error.code).toBe("INVALID_TAP");
  });

  it("rejects a malformed tap", async () => {
    const res = await tap(fx.deviceIdentifier, "not-a-mirror");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TAP");
  });

  it("lets a tap token be used for only one stamp", async () => {
    await join(fx.customerToken, fx.programId);

    const tapRes = await tap(fx.deviceIdentifier);
    const first = await stampWithTap(fx.customerToken, tapRes.body.data.tapToken, "single-use-1");
    const second = await stampWithTap(fx.customerToken, tapRes.body.data.tapToken, "single-use-2");

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("TAP_EXPIRED");
  });

  it("keeps the tap usable when the stamp is refused, so the customer can join and continue", async () => {
    const tapRes = await tap(fx.deviceIdentifier);

    const refused = await stampWithTap(fx.customerToken, tapRes.body.data.tapToken, "join-first-1");
    expect(refused.body.error.code).toBe("NOT_ENROLLED");

    await join(fx.customerToken, fx.programId);
    const accepted = await stampWithTap(
      fx.customerToken,
      tapRes.body.data.tapToken,
      "join-first-2",
    );
    expect(accepted.status).toBe(201);
  });

  it("refuses a bare device identifier for a stamper that reports taps", async () => {
    await join(fx.customerToken, fx.programId);

    const res = await api()
      .post("/api/v1/stamps")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .set("Idempotency-Key", "bare-identifier")
      .send({ deviceIdentifier: fx.deviceIdentifier, source: "NFC" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TAP_REQUIRED");
  });

  it("still accepts a bare device identifier for a STATIC stamper", async () => {
    await NfcDevice.updateOne({ deviceIdentifier: fx.deviceIdentifier }, { tagType: "STATIC" });
    await join(fx.customerToken, fx.programId);

    const res = await api()
      .post("/api/v1/stamps")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .set("Idempotency-Key", "static-key")
      .send({ deviceIdentifier: fx.deviceIdentifier, source: "NFC" });

    expect(res.status).toBe(201);
  });
  it("unlocks each reward tier as the card reaches it", async () => {
    const tierRes = await api()
      .post(`/api/v1/businesses/${fx.businessId}/rewards`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({
        programId: fx.programId,
        name: "Free Biscuit",
        type: "FREE_ITEM",
        requiredStamps: 2,
      });
    expect(tierRes.status).toBe(201);

    await join(fx.customerToken, fx.programId);

    const first = await stamp(fx.customerToken, fx.deviceIdentifier, "tier-key-1");
    const second = await stamp(fx.customerToken, fx.deviceIdentifier, "tier-key-2");
    const third = await stamp(fx.customerToken, fx.deviceIdentifier, "tier-key-3");

    expect(first.body.data.unlockedRewards).toEqual([]);
    expect(second.body.data.unlockedReward.rewardName).toBe("Free Biscuit");
    expect(second.body.data.card.stampCount).toBe(2);
    expect(third.body.data.unlockedReward.rewardName).toBe("Free Coffee");
    expect(third.body.data.card.stampCount).toBe(0);
  });

  it("rejects a reward that needs more stamps than the card holds", async () => {
    const res = await api()
      .post(`/api/v1/businesses/${fx.businessId}/rewards`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ programId: fx.programId, name: "Unreachable", type: "FREE_ITEM", requiredStamps: 5 });

    expect(res.status).toBe(400);
  });

  it("rejects shrinking a program below one of its active rewards", async () => {
    const res = await api()
      .patch(`/api/v1/businesses/${fx.businessId}/programs/${fx.programId}`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ requiredStamps: 2 });

    expect(res.status).toBe(400);
  });

  it("issues a manual stamp through the same rules, audited and idempotent", async () => {
    const joinRes = await join(fx.customerToken, fx.programId);
    const loyaltyCardId = joinRes.body.data._id as string;

    const manual = (key: string, token = fx.ownerToken) =>
      api()
        .post(`/api/v1/businesses/${fx.businessId}/stamps/manual`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", key)
        .send({ loyaltyCardId, branchId: fx.branchId });

    const first = await manual("manual-key-1");
    expect(first.status).toBe(201);
    expect(first.body.data.card.stampCount).toBe(1);

    const retry = await manual("manual-key-1");
    expect(retry.status).toBe(200);
    expect(retry.body.data.alreadyRecorded).toBe(true);

    const audits = await AuditLog.countDocuments({ action: "stamp.issued_manual" });
    expect(audits).toBe(1);

    const byCustomer = await manual("manual-key-2", fx.customerToken);
    expect(byCustomer.status).toBe(403);
  });

  it("applies the cooldown to manual stamps", async () => {
    await api()
      .patch(`/api/v1/businesses/${fx.businessId}/programs/${fx.programId}`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .send({ minMinutesBetweenStamps: 10 });

    const joinRes = await join(fx.customerToken, fx.programId);
    const body = { loyaltyCardId: joinRes.body.data._id, branchId: fx.branchId };

    await api()
      .post(`/api/v1/businesses/${fx.businessId}/stamps/manual`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .set("Idempotency-Key", "manual-cooldown-1")
      .send(body);
    const second = await api()
      .post(`/api/v1/businesses/${fx.businessId}/stamps/manual`)
      .set("Authorization", `Bearer ${fx.ownerToken}`)
      .set("Idempotency-Key", "manual-cooldown-2")
      .send(body);

    expect(second.status).toBe(429);
  });

  it("counts active customers in the business overview", async () => {
    await join(fx.customerToken, fx.programId);
    await stamp(fx.customerToken, fx.deviceIdentifier, "overview-key-1");

    const res = await api()
      .get(`/api/v1/businesses/${fx.businessId}/analytics/overview`)
      .set("Authorization", `Bearer ${fx.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activeCustomers).toBe(1);
    expect(res.body.data.totalStamps).toBe(1);
  });
});
