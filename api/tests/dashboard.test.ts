import { beforeEach, describe, expect, it } from "vitest";
import { Business, BusinessMember, NfcDevice } from "@/models";
import { createBusiness } from "@/modules/businesses/businesses.service";
import { PASSWORD, api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

interface Fixture {
  owner: string;
  businessId: string;
  branchA: string;
  branchB: string;
  programId: string;
  deviceId: string;
}

async function setUp(): Promise<Fixture> {
  const owner = await registerUser("owner@example.com", "Owner");
  const business = await createBusiness(owner.userId, {
    name: "Multan Mithai",
    category: "BAKERY",
  });
  const businessId = business._id.toString();
  await Business.updateOne({ _id: businessId }, { status: "ACTIVE" });
  await enableMfa(owner.token);

  const b = `/api/v1/businesses/${businessId}`;
  const branchA = (
    await api().post(`${b}/branches`).set(bearer(owner.token)).send({ name: "Cantt" })
  ).body.data._id as string;
  const branchB = (
    await api().post(`${b}/branches`).set(bearer(owner.token)).send({ name: "Bosan Road" })
  ).body.data._id as string;
  const programId = (
    await api()
      .post(`${b}/programs`)
      .set(bearer(owner.token))
      .send({ name: "Sweet Card", requiredStamps: 5, minMinutesBetweenStamps: 0 })
  ).body.data._id as string;
  await api()
    .post(`${b}/rewards`)
    .set(bearer(owner.token))
    .send({ programId, name: "Free Barfi", type: "FREE_ITEM", requiredStamps: 5 });

  const device = await NfcDevice.create({
    deviceIdentifier: "MULT01",
    businessId,
    branchId: branchA,
    status: "ACTIVE",
  });

  return {
    owner: owner.token,
    businessId,
    branchA,
    branchB,
    programId,
    deviceId: device._id.toString(),
  };
}

/** A member with the given role, already active, optionally limited to some branches. */
async function member(
  fx: Fixture,
  email: string,
  role: "MANAGER" | "STAFF",
  branchIds: string[] = [],
) {
  const user = await registerUser(email, role);
  await BusinessMember.create({
    userId: user.userId,
    businessId: fx.businessId,
    role,
    branchIds,
    status: "ACTIVE",
  });
  return user.token;
}

describe("business dashboard backend", () => {
  let fx: Fixture;
  const path = (p: string) => `/api/v1/businesses/${fx.businessId}${p}`;

  beforeEach(async () => {
    fx = await setUp();
  });

  it("makes a suspended business read-only and says why", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    await api()
      .patch(`/api/v1/admin/businesses/${fx.businessId}/status`)
      .set(bearer(admin.token))
      .send({ status: "SUSPENDED", reason: "Unpaid invoice for October" });

    expect((await api().get(path("/programs")).set(bearer(fx.owner))).status).toBe(200);

    const blocked = await api().post(path("/branches")).set(bearer(fx.owner)).send({ name: "New" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("BUSINESS_SUSPENDED");
    expect(blocked.body.error.message).toContain("Unpaid invoice for October");

    await api()
      .patch(`/api/v1/admin/businesses/${fx.businessId}/status`)
      .set(bearer(admin.token))
      .send({ status: "ACTIVE", reason: "Paid" });
    const after = await api().post(path("/branches")).set(bearer(fx.owner)).send({ name: "New" });
    expect(after.status).toBe(201);
    expect((await Business.findById(fx.businessId))!.suspension?.reason).toBeUndefined();
  });

  it("keeps a branch-limited manager to their own branch", async () => {
    const manager = await member(fx, "manager@example.com", "MANAGER", [fx.branchA]);
    const customer = await registerUser("cust@example.com");
    const card = await api()
      .post("/api/v1/loyalty-cards/join")
      .set(bearer(customer.token))
      .send({ programId: fx.programId });
    const loyaltyCardId = card.body.data._id as string;

    const stampAt = (branchId: string, key: string) =>
      api()
        .post(path("/stamps/manual"))
        .set(bearer(manager))
        .set("Idempotency-Key", key)
        .send({ loyaltyCardId, branchId });

    expect((await stampAt(fx.branchB, "scope-key-b")).status).toBe(403);
    expect((await stampAt(fx.branchA, "scope-key-a")).status).toBe(201);

    // Activity lists only show their branch.
    const stamps = await api().get(path("/stamps")).set(bearer(manager));
    expect(stamps.body.meta.total).toBe(1);
    const otherBranch = await api()
      .get(path(`/stamps?branchId=${fx.branchB}`))
      .set(bearer(manager));
    expect(otherBranch.status).toBe(403);

    // Validating a reward needs a branch they work at.
    const noBranch = await api()
      .post(path("/redemptions/validate"))
      .set(bearer(manager))
      .send({ redemptionCode: "ABCDEFGH" });
    expect(noBranch.status).toBe(400);
  });

  it("lists customers with masked contact details and finds them by phone digits", async () => {
    const res = await api().post("/api/v1/auth/register").send({
      name: "Sadia Malik",
      email: "sadia@example.com",
      password: PASSWORD,
      phone: "+923004561234",
    });
    const customerToken = res.body.data.accessToken as string;
    const customerId = res.body.data.user.id as string;
    await api()
      .post("/api/v1/loyalty-cards/join")
      .set(bearer(customerToken))
      .send({ programId: fx.programId });

    const list = await api().get(path("/customers")).set(bearer(fx.owner));
    expect(list.body.data[0].customer).toEqual({
      id: customerId,
      name: "Sadia Malik",
      phone: "+923•••••1234",
      email: "s•••@example.com",
    });
    expect(JSON.stringify(list.body)).not.toContain("4561234");

    const byDigits = await api().get(path("/customers?q=1234")).set(bearer(fx.owner));
    expect(byDigits.body.meta.total).toBe(1);

    const detail = await api()
      .get(path(`/customers/${customerId}`))
      .set(bearer(fx.owner));
    expect(detail.body.data.cards[0].program.name).toBe("Sweet Card");

    // Someone without a card here is not visible to this business.
    const stranger = await registerUser("stranger@example.com");
    expect(
      (
        await api()
          .get(path(`/customers/${stranger.userId}`))
          .set(bearer(fx.owner))
      ).status,
    ).toBe(404);
    // Customers cannot reach the list at all.
    expect((await api().get(path("/customers")).set(bearer(customerToken))).status).toBe(403);
  });

  it("reports what is left to set up", async () => {
    const before = await api().get(path("/onboarding")).set(bearer(fx.owner));
    expect(before.body.data.steps).toMatchObject({
      profile: false,
      branch: true,
      program: true,
      reward: true,
      stamper: true,
      staff: false,
    });
    expect(before.body.data.ready).toBe(false);

    await api()
      .patch(`/api/v1/businesses/${fx.businessId}`)
      .set(bearer(fx.owner))
      .send({ contact: { phone: "061 4501234", address: "Cantt, Multan" } });
    const after = await api().get(path("/onboarding")).set(bearer(fx.owner));
    expect(after.body.data.ready).toBe(true);
  });

  it("lets an invited staff member see, accept or decline the invitation", async () => {
    const staff = await registerUser("cashier@example.com");
    const second = await registerUser("helper@example.com");
    await api()
      .post(path("/members"))
      .set(bearer(fx.owner))
      .send({ email: "cashier@example.com", role: "STAFF" });
    await api()
      .post(path("/members"))
      .set(bearer(fx.owner))
      .send({ email: "helper@example.com", role: "STAFF" });

    const pending = await api().get("/api/v1/businesses/invitations").set(bearer(staff.token));
    expect(pending.body.data[0].business.name).toBe("Multan Mithai");

    // Before accepting, the business is not theirs to open.
    expect((await api().get(path("/customers")).set(bearer(staff.token))).status).toBe(403);
    await api().post(path("/members/accept")).set(bearer(staff.token));
    expect((await api().get(path("/customers")).set(bearer(staff.token))).status).toBe(200);

    await api().post(path("/members/decline")).set(bearer(second.token));
    expect(await BusinessMember.exists({ userId: second.userId })).toBeNull();
  });

  it("revokes a stamper reported lost, so it stops stamping", async () => {
    const staff = await member(fx, "staff@example.com", "STAFF");

    const visible = await api().get(path("/devices")).set(bearer(staff));
    expect(visible.status).toBe(200);
    expect(visible.body.data).toHaveLength(1);

    const report = await api()
      .post(path(`/devices/${fx.deviceId}/report`))
      .set(bearer(staff))
      .send({ reason: "LOST", note: "Not on the counter this morning" });
    expect(report.status).toBe(200);
    expect(report.body.data.status).toBe("REVOKED");

    const tap = await api()
      .post("/api/v1/taps")
      .send({ deviceIdentifier: "MULT01", params: { m: "04A1B2C3D4E5F6x000001" } });
    expect(tap.status).toBe(400);

    // Staff can report, but not revoke or replace directly.
    expect(
      (
        await api()
          .post(path(`/devices/${fx.deviceId}/replace`))
          .set(bearer(staff))
      ).status,
    ).toBe(403);
  });
});
