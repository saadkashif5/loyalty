import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { LoyaltyCard, Redemption, Stamp, User } from "@/models";
import { testOutbox } from "@/services/email.service";
import { api, bearer, platformUser, registerUser } from "./helpers";

async function customerWithHistory() {
  const customer = await registerUser("ayesha@example.com", "Ayesha");
  const businessId = new Types.ObjectId();
  const programId = new Types.ObjectId();
  const card = await LoyaltyCard.create({
    customerId: customer.userId,
    businessId,
    programId,
    stampCount: 3,
  });
  await Stamp.create({
    businessId,
    branchId: new Types.ObjectId(),
    programId,
    loyaltyCardId: card._id,
    customerId: customer.userId,
    source: "NFC",
    idempotencyKey: "ayesha-1",
  });
  await Redemption.create({
    rewardId: new Types.ObjectId(),
    customerId: customer.userId,
    loyaltyCardId: card._id,
    businessId,
    programId,
    redemptionCode: "AYESHA01",
    status: "PENDING",
  });
  return customer;
}

const remove = (token: string, confirm = "DELETE") =>
  api().delete("/api/v1/users/me").set(bearer(token)).send({ confirm });

describe("customer data export", () => {
  it("includes the profile, cards, stamps and rewards", async () => {
    const customer = await customerWithHistory();
    const res = await api().get("/api/v1/users/me/export").set(bearer(customer.token));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    const data = JSON.parse(res.text);
    expect(data.account.email).toBe("ayesha@example.com");
    expect(data.cards).toHaveLength(1);
    expect(data.stamps).toHaveLength(1);
    expect(data.rewards).toHaveLength(1);
  });
});

describe("customer account deletion", () => {
  it("erases the person, signs them out, cancels pending rewards and keeps the anonymous stamps", async () => {
    const customer = await customerWithHistory();
    expect((await remove(customer.token, "delete please")).status).toBe(400);

    expect((await remove(customer.token)).status).toBe(200);

    const user = await User.findById(customer.userId).select("+passwordHash");
    expect(user!.status).toBe("DELETED");
    expect(user!.name).toBe("Deleted account");
    expect(user!.email).not.toContain("ayesha");
    expect(user!.passwordHash).toBeUndefined();
    expect((await Redemption.findOne())!.status).toBe("CANCELLED");
    expect(await Stamp.countDocuments({ customerId: customer.userId })).toBe(1);

    expect((await api().get("/api/v1/users/me").set(bearer(customer.token))).status).toBe(401);
    expect(
      testOutbox().some((m) => m.to === "ayesha@example.com" && /deleted/.test(m.subject)),
    ).toBe(true);
  });

  it("lets the same email sign up again as a new account", async () => {
    const customer = await customerWithHistory();
    await remove(customer.token);
    const again = await registerUser("ayesha@example.com", "Ayesha again");
    expect(again.userId).not.toBe(customer.userId);
  });

  it("refuses platform team accounts", async () => {
    const admin = await platformUser("team@example.com", "SUPPORT");
    expect((await remove(admin.token)).status).toBe(400);
  });
});
