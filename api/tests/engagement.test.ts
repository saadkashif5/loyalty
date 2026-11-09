import { describe, expect, it } from "vitest";
import { Business, CustomerConsent, LoyaltyCard, NfcDevice, Notification, Stamp } from "@/models";
import { createBusiness } from "@/modules/businesses/businesses.service";
import { BUSINESS_STATUS } from "@taptapsell/constants";
import { api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

let counter = 0;
const settle = () => new Promise((r) => setTimeout(r, 150));

async function setup(programExtras: Record<string, unknown> = {}) {
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
  const program = await api()
    .post(as("/programs"))
    .set(bearer(owner.token))
    .send({ name: "Chai Card", requiredStamps: 5, ...programExtras });
  expect(program.status).toBe(201);
  await NfcDevice.create({ deviceIdentifier: "TAP123", businessId, branchId, status: "ACTIVE" });
  return { owner, businessId, programId: program.body.data._id as string, as };
}

const join = (token: string, programId: string) =>
  api().post("/api/v1/loyalty-cards/join").set(bearer(token)).send({ programId });

async function tapStamp(token: string, key: string) {
  counter += 1;
  const m = `04A1B2C3D4E5F6x${counter.toString(16).toUpperCase().padStart(6, "0")}`;
  const tap = await api().post("/api/v1/taps").send({ deviceIdentifier: "TAP123", params: { m } });
  return api()
    .post("/api/v1/stamps")
    .set(bearer(token))
    .set("Idempotency-Key", `stamp-key-${key}`)
    .send({ tapToken: tap.body.data.tapToken });
}

describe("welcome stamp", () => {
  it("gives one free stamp on joining, without blocking the first visit", async () => {
    const fx = await setup({ welcomeStamp: true });
    const customer = await registerUser("ayesha@example.com");
    const joined = await join(customer.token, fx.programId);
    expect(joined.body.data.stampCount).toBe(1);
    expect((await Stamp.findOne())!.source).toBe("WELCOME");

    // The default five-minute cooldown does not count the welcome stamp.
    const visit = await tapStamp(customer.token, "v1");
    expect(visit.status).toBe(201);
    expect(visit.body.data.card.stampCount).toBe(2);

    // Joining again neither duplicates the card nor the welcome stamp.
    await join(customer.token, fx.programId);
    expect(await Stamp.countDocuments({ source: "WELCOME" })).toBe(1);
    expect((await LoyaltyCard.findOne())!.stampCount).toBe(2);

    // A second real visit straight away still meets the cooldown.
    expect((await tapStamp(customer.token, "v2")).status).toBe(429);
  });

  it("is off unless the program turns it on", async () => {
    const fx = await setup();
    const customer = await registerUser("ayesha@example.com");
    expect((await join(customer.token, fx.programId)).body.data.stampCount).toBe(0);
  });
});

describe("notification centre", () => {
  it("counts unread and marks everything read", async () => {
    const fx = await setup({ welcomeStamp: true, minMinutesBetweenStamps: 0 });
    const customer = await registerUser("ayesha@example.com");
    await join(customer.token, fx.programId);
    await tapStamp(customer.token, "v1");
    await settle();

    const summary = () => api().get("/api/v1/notifications/summary").set(bearer(customer.token));
    expect((await summary()).body.data.unread).toBe(2);
    const all = await api().post("/api/v1/notifications/read-all").set(bearer(customer.token));
    expect(all.body.data.marked).toBe(2);
    expect((await summary()).body.data.unread).toBe(0);
    expect(await Notification.countDocuments({ status: "READ" })).toBe(2);
  });
});

describe("profile and WhatsApp consent", () => {
  it("needs a mobile number and a card, and the business sees only a count", async () => {
    const fx = await setup();
    const customer = await registerUser("ayesha@example.com");
    const other = await registerUser("other@example.com");
    const consent = (token: string, whatsapp: boolean) =>
      api().put(`/api/v1/users/me/consents/${fx.businessId}`).set(bearer(token)).send({ whatsapp });
    const profile = (token: string, body: object) =>
      api().patch("/api/v1/users/me").set(bearer(token)).send(body);

    expect((await consent(customer.token, true)).status).toBe(404); // no card yet
    await join(customer.token, fx.programId);
    expect((await consent(customer.token, true)).status).toBe(400); // no number yet

    expect((await profile(customer.token, { phone: "12345" })).status).toBe(400);
    const saved = await profile(customer.token, { phone: "0300 1234567", name: "Ayesha K" });
    expect(saved.body.data).toMatchObject({ phone: "+923001234567", name: "Ayesha K" });
    expect((await profile(other.token, { phone: "03001234567" })).status).toBe(409);

    expect((await consent(customer.token, true)).body.data.whatsapp).toBe(true);
    const mine = await api().get("/api/v1/users/me/consents").set(bearer(customer.token));
    expect(mine.body.data).toEqual([
      { businessId: fx.businessId, business: "Chai Wala Cafe", whatsapp: true },
    ]);
    const count = await api().get(fx.as("/customers/consents")).set(bearer(fx.owner.token));
    expect(count.body.data.whatsapp).toBe(1);

    // Removing the number withdraws every WhatsApp agreement.
    await profile(customer.token, { phone: "" });
    const record = await CustomerConsent.findOne();
    expect(record!.whatsapp).toBe(false);
    expect(record!.withdrawnAt).toBeTruthy();
  });
});

describe("support notes and pilot metrics", () => {
  it("lets the team keep notes on a business", async () => {
    const fx = await setup();
    const agent = await platformUser("help@example.com", "SUPPORT");
    const notes = `/api/v1/admin/businesses/${fx.businessId}/notes`;
    expect((await api().post(notes).set(bearer(agent.token)).send({ body: " " })).status).toBe(400);
    const added = await api()
      .post(notes)
      .set(bearer(agent.token))
      .send({ body: "Owner called: stamper at Gulberg not reading." });
    expect(added.status).toBe(201);
    const list = await api().get(notes).set(bearer(agent.token));
    expect(list.body.data[0]).toMatchObject({
      body: "Owner called: stamper at Gulberg not reading.",
      authorId: { email: "help@example.com" },
    });
    const customer = await registerUser("ayesha@example.com");
    expect((await api().get(notes).set(bearer(customer.token))).status).toBe(403);
  });

  it("reports taps, stamps, repeat visits and redemptions", async () => {
    const fx = await setup({ minMinutesBetweenStamps: 0 });
    const customer = await registerUser("ayesha@example.com");
    await join(customer.token, fx.programId);
    await tapStamp(customer.token, "v1");
    await api()
      .post("/api/v1/taps")
      .send({ deviceIdentifier: "TAP123", params: { m: "junk" } });
    // A stamp on an earlier day makes this card a returning one.
    const card = await LoyaltyCard.findOne();
    const first = await Stamp.findOne();
    await Stamp.create({
      ...first!.toObject(),
      _id: undefined,
      idempotencyKey: "earlier-visit",
      createdAt: new Date(Date.now() - 3 * 86_400_000),
      loyaltyCardId: card!._id,
    });
    await settle();

    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const res = await api().get("/api/v1/admin/metrics/pilot?days=30").set(bearer(root.token));
    expect(res.status).toBe(200);
    const { totals, businesses } = res.body.data;
    expect(totals).toMatchObject({ tapsVerified: 1, tapsRejected: 1, stamps: 1, newCards: 1 });
    expect(totals.tapSuccessPercent).toBe(50);
    expect(totals.repeatPercent).toBe(100);
    expect(businesses[0]).toMatchObject({ name: "Chai Wala Cafe", stamps: 1 });
  });
});
