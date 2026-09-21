import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { createApp } from "@/app";
import { Business, NfcDevice, User } from "@/models";
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

function stamp(token: string, deviceIdentifier: string, idempotencyKey: string) {
  return api()
    .post("/api/v1/stamps")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", idempotencyKey)
    .send({ deviceIdentifier, source: "NFC" });
}

describe("core loyalty loop", () => {
  let fx: Fixture;

  beforeEach(async () => {
    fx = await seedBusinessWithProgram();
  });

  it("runs business setup -> join -> stamp -> reward unlock -> redemption", async () => {
    const joinRes = await api()
      .post("/api/v1/loyalty-cards/join")
      .set("Authorization", `Bearer ${fx.customerToken}`)
      .send({ programId: fx.programId });
    expect(joinRes.status).toBe(201);

    const first = await stamp(fx.customerToken, fx.deviceIdentifier, "key-1");
    expect(first.status).toBe(201);
    expect(first.body.data.card.stampCount).toBe(1);
    expect(first.body.data.unlockedReward).toBeNull();

    await stamp(fx.customerToken, fx.deviceIdentifier, "key-2");
    const third = await stamp(fx.customerToken, fx.deviceIdentifier, "key-3");

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

    const first = await stamp(fx.customerToken, fx.deviceIdentifier, "retry-key");
    const retry = await stamp(fx.customerToken, fx.deviceIdentifier, "retry-key");

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
});
