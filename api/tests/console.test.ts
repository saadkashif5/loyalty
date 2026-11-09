import { describe, expect, it } from "vitest";
import { AuditLog, NfcDevice, SupportAccess } from "@/models";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

async function onboard(rootToken: string, name: string, email: string, city?: string) {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({
      business: { name, category: "CAFE", ...(city ? { contact: { city } } : {}) },
      owner: { name: "Owner", email },
      planCode: name.startsWith("Growth") ? "GROWTH" : "STARTER",
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

describe("support view of a business", () => {
  it("gives read-only, time-limited, audited access", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const agent = await platformUser("help@example.com", "SUPPORT");
    const { businessId } = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    const path = `/api/v1/businesses/${businessId}`;

    // No view open: same answer as any outsider.
    expect((await api().get(`${path}/branches`).set(bearer(agent.token))).status).toBe(403);

    const reasonless = await api()
      .post(`/api/v1/admin/businesses/${businessId}/support-view`)
      .set(bearer(agent.token))
      .send({});
    expect(reasonless.status).toBe(400);

    const started = await api()
      .post(`/api/v1/admin/businesses/${businessId}/support-view`)
      .set(bearer(agent.token))
      .send({ reason: "Owner says stamps are missing" });
    expect(started.status).toBe(201);
    expect(started.body.data.dashboardUrl).toContain(`/b/${businessId}`);

    // Reads work and are kept with the view; writes are refused.
    expect((await api().get(`${path}/branches`).set(bearer(agent.token))).status).toBe(200);
    const write = await api()
      .post(`${path}/branches`)
      .set(bearer(agent.token))
      .send({ name: "Planted" });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe("SUPPORT_VIEW_READ_ONLY");

    // The dashboard lists the business, marked as a support view.
    const mine = await api().get("/api/v1/businesses").set(bearer(agent.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].supportView.reason).toBe("Owner says stamps are missing");

    await new Promise((r) => setTimeout(r, 50));
    const grant = await SupportAccess.findOne();
    expect(grant!.views.map((v) => v.path)).toContain(`${path}/branches`);

    const detail = await api()
      .get(`/api/v1/admin/businesses/${businessId}`)
      .set(bearer(root.token));
    expect(detail.body.data.supportViews[0]).toMatchObject({ active: true, pagesViewed: 1 });

    // Ending it shuts access at once.
    await api()
      .delete(`/api/v1/admin/businesses/${businessId}/support-view`)
      .set(bearer(agent.token));
    expect((await api().get(`${path}/branches`).set(bearer(agent.token))).status).toBe(403);

    const actions = (await AuditLog.find({ businessId }).select("action")).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["support.view_started", "support.view_ended"]));
  });

  it("expires on its own", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    await api()
      .post(`/api/v1/admin/businesses/${businessId}/support-view`)
      .set(bearer(root.token))
      .send({ reason: "Checking the setup" });
    await SupportAccess.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await api()
      .get(`/api/v1/businesses/${businessId}/branches`)
      .set(bearer(root.token));
    expect(res.status).toBe(403);
  });

  it("is not open to finance, or to customers", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const finance = await platformUser("money@example.com", "FINANCE");
    const { businessId } = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    const res = await api()
      .post(`/api/v1/admin/businesses/${businessId}/support-view`)
      .set(bearer(finance.token))
      .send({ reason: "Looking around" });
    expect(res.status).toBe(403);
  });
});

describe("console filters", () => {
  it("filters businesses by plan and city, and lists the cities", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await onboard(root.token, "Alpha Cafe", "alpha@example.com", "Lahore");
    await onboard(root.token, "Growth Bakery", "beta@example.com", "Karachi");
    await onboard(root.token, "Gamma Salon", "gamma@example.com", "lahore");

    const list = (query: string) =>
      api().get(`/api/v1/admin/businesses?${query}`).set(bearer(root.token));

    const lahore = await list("city=LAHORE");
    expect(lahore.body.data.map((b: { name: string }) => b.name).sort()).toEqual([
      "Alpha Cafe",
      "Gamma Salon",
    ]);
    const growth = await list("plan=growth");
    expect(growth.body.data).toHaveLength(1);
    expect(growth.body.data[0].plan.code).toBe("GROWTH");
    expect((await list("plan=GROWTH&city=Lahore")).body.meta.total).toBe(0);

    const cities = await api().get("/api/v1/admin/businesses/cities").set(bearer(root.token));
    expect(cities.body.data).toEqual(["Karachi", "Lahore"]);
  });

  it("filters the audit log by action, person and date", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    await AuditLog.create({
      action: "device.revoked",
      resourceType: "NfcDevice",
      createdAt: new Date("2025-01-10T12:00:00Z"),
    });

    const audit = (query: string) =>
      api().get(`/api/v1/admin/audit-logs?${query}`).set(bearer(root.token));

    const family = await audit("action=device.");
    expect(family.body.data.map((e: { action: string }) => e.action)).toEqual(["device.revoked"]);

    const byRoot = await audit("actor=ROOT@example.com");
    expect(byRoot.body.data.length).toBeGreaterThan(0);
    expect(
      byRoot.body.data.every(
        (e: { actorUserId: { email: string } }) => e.actorUserId.email === "root@example.com",
      ),
    ).toBe(true);
    expect((await audit("actor=nobody@example.com")).body.data).toEqual([]);

    const day = await audit("from=2025-01-10&to=2025-01-10");
    expect(day.body.data).toHaveLength(1);
    expect((await audit("from=2025-01-11&to=2025-01-31")).body.data).toHaveLength(0);

    expect((await audit(`businessId=${businessId}&action=business.created`)).status).toBe(200);
    expect((await audit("businessId=nope")).status).toBe(400);
  });
});

describe("stamper tag reset", () => {
  it("forgets the bound chip and counter, with a reason, audited", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const device = await NfcDevice.create({
      deviceIdentifier: "STAMPER-RESET-1",
      tagUid: "04AABBCCDDEEFF",
      lastTapCounter: 42,
    });
    const reset = (body: object) =>
      api().post(`/api/v1/admin/devices/${device.id}/reset-tag`).set(bearer(root.token)).send(body);

    expect((await reset({})).status).toBe(400);
    expect((await reset({ reason: "Tag replaced after water damage" })).status).toBe(200);

    const after = await NfcDevice.findById(device._id);
    expect(after!.tagUid).toBeNull();
    expect(after!.lastTapCounter).toBeNull();
    const entry = await AuditLog.findOne({ action: "device.tag_reset" });
    expect(entry!.metadata).toMatchObject({ tagUid: "04AABBCCDDEEFF", lastTapCounter: 42 });

    const support = await platformUser("help@example.com", "SUPPORT");
    const refused = await api()
      .post(`/api/v1/admin/devices/${device.id}/reset-tag`)
      .set(bearer(support.token))
      .send({ reason: "Tag replaced" });
    expect(refused.status).toBe(403);
  });
});

describe("stamper shipping and labels", () => {
  it("ships an assigned stamper, tells the owner, and prints labels", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId } = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    const spare = await NfcDevice.create({ deviceIdentifier: "SPARE-1" });
    const device = await NfcDevice.create({
      deviceIdentifier: "SHIP-1",
      businessId,
      status: "ASSIGNED",
    });
    const ship = (id: string, body: object = {}) =>
      api().post(`/api/v1/admin/devices/${id}/ship`).set(bearer(root.token)).send(body);

    expect((await ship(spare.id)).status).toBe(400);
    const shipped = await ship(device.id, { courier: "TCS", trackingNumber: "TCS-778" });
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.shipment).toMatchObject({ courier: "TCS", trackingNumber: "TCS-778" });

    const mail = testOutbox().find((m) => m.to === "alpha@example.com" && /SHIP-1/.test(m.subject));
    expect(mail!.text).toContain("TCS-778");
    expect(mail!.text).toContain("/activate?device=SHIP-1");
    expect(await AuditLog.exists({ action: "device.shipped" })).toBeTruthy();

    const labels = await api()
      .get(`/api/v1/admin/devices/labels?ids=${device.id},${spare.id},nope`)
      .set(bearer(root.token));
    expect(labels.body.data.map((l: { deviceIdentifier: string }) => l.deviceIdentifier)).toEqual([
      "SHIP-1",
      "SPARE-1",
    ]);
    expect(labels.body.data[0]).toMatchObject({ business: "Alpha Cafe" });
    expect(JSON.stringify(labels.body)).not.toContain("activationCode");
  });

  it("gives each minted stamper an activation link alongside its code", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const minted = await api()
      .post("/api/v1/admin/devices")
      .set(bearer(root.token))
      .send({ quantity: 2 });
    expect(minted.status).toBe(201);
    for (const d of minted.body.data) {
      expect(d.activationCode).toEqual(expect.any(String));
      expect(d.activateUrl).toContain(`/activate?device=${d.deviceIdentifier}`);
    }
  });
});
