import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { LoyaltyCard, Notification, Redemption, Reward, Stamp } from "@/models";
import { api, bearer, registerUser } from "./helpers";

// One customer must never see or act on another customer's cards, rewards,
// stamps or notifications, even with the other's ids in hand.
async function twoCustomers() {
  const businessId = new Types.ObjectId();
  const programId = new Types.ObjectId();
  const alice = await registerUser("alice@example.com", "Alice");
  const bilal = await registerUser("bilal@example.com", "Bilal");

  const [aliceCard, bilalCard] = await Promise.all(
    [alice, bilal].map((c) =>
      LoyaltyCard.create({ customerId: c.userId, businessId, programId, stampCount: 10 }),
    ),
  );
  const reward = await Reward.create({
    businessId,
    programId,
    name: "Free chai",
    type: "FREE_ITEM",
    requiredStamps: 5,
    status: "ACTIVE",
  });
  await Stamp.create({
    businessId,
    branchId: new Types.ObjectId(),
    programId,
    loyaltyCardId: bilalCard._id,
    customerId: bilal.userId,
    source: "NFC",
    idempotencyKey: "bilal-stamp-1",
  });
  const notification = await Notification.create({
    userId: bilal.userId,
    type: "STAMP_ADDED",
    title: "Stamp added",
    body: "10 of 10",
  });
  return { alice, bilal, aliceCard, bilalCard, reward, notification };
}

describe("customer isolation", () => {
  it("hides another customer's card and refuses a counter code for it", async () => {
    const { alice, bilalCard, aliceCard } = await twoCustomers();
    const asAlice = bearer(alice.token);

    expect((await api().get(`/api/v1/loyalty-cards/${bilalCard._id}`).set(asAlice)).status).toBe(
      404,
    );
    const code = await api()
      .post(`/api/v1/loyalty-cards/${bilalCard._id}/counter-code`)
      .set(asAlice);
    expect(code.status).toBe(404);

    const mine = await api().get("/api/v1/loyalty-cards").set(asAlice);
    expect(mine.body.data.map((c: { _id?: string; id?: string }) => c._id ?? c.id)).toEqual([
      String(aliceCard._id),
    ]);
  });

  it("refuses to claim or read a reward on another customer's card", async () => {
    const { alice, bilal, bilalCard, reward } = await twoCustomers();

    const claim = await api()
      .post("/api/v1/redemptions")
      .set(bearer(alice.token))
      .set("Idempotency-Key", "alice-claims-bilal")
      .send({ rewardId: String(reward._id), loyaltyCardId: String(bilalCard._id) });
    expect(claim.status).toBe(404);
    expect(await Redemption.countDocuments()).toBe(0);

    const own = await api()
      .post("/api/v1/redemptions")
      .set(bearer(bilal.token))
      .set("Idempotency-Key", "bilal-claims-own")
      .send({ rewardId: String(reward._id), loyaltyCardId: String(bilalCard._id) });
    expect(own.status).toBe(201);
    const redemptionId = own.body.data._id ?? own.body.data.id;

    const peek = await api().get(`/api/v1/redemptions/${redemptionId}`).set(bearer(alice.token));
    expect(peek.status).toBe(404);
    const list = await api().get("/api/v1/redemptions/me").set(bearer(alice.token));
    expect(list.body.data).toEqual([]);
  });

  it("shows each customer only their own stamps and notifications", async () => {
    const { alice, notification } = await twoCustomers();
    const asAlice = bearer(alice.token);

    expect((await api().get("/api/v1/stamps/me").set(asAlice)).body.data).toEqual([]);
    expect((await api().get("/api/v1/notifications").set(asAlice)).body.data).toEqual([]);

    const read = await api().post(`/api/v1/notifications/${notification._id}/read`).set(asAlice);
    expect(read.status).toBe(404);
    expect((await Notification.findById(notification._id))!.status).not.toBe("READ");
  });
});
