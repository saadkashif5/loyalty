import { describe, expect, it } from "vitest";
import { BusinessMember, ExportJob, User } from "@/models";
import { processExports } from "@/services/exports.service";
import { PASSWORD, api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

async function onboard(rootToken: string, name: string, email: string) {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({ business: { name, category: "CAFE" }, owner: { name: "Owner", email } });
  const businessId = invite.body.data.business._id as string;
  const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
  const accepted = await api()
    .post(`/api/v1/invitations/${token}/accept`)
    .send({ password: PASSWORD });
  const ownerToken = accepted.body.data.accessToken as string;
  await enableMfa(ownerToken);
  return { businessId, ownerToken };
}

describe("exports built by the worker", () => {
  it("gives owners their customer list as a CSV, contact details masked", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const a = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    const b = await onboard(root.token, "Beta Bakery", "beta@example.com");
    const as = (path: string) => `/api/v1/businesses/${a.businessId}${path}`;

    const program = await api()
      .post(as("/programs"))
      .set(bearer(a.ownerToken))
      .send({ name: "Chai Card", requiredStamps: 5 });
    const customer = await registerUser("ayesha@example.com", "Ayesha");
    await User.updateOne({ _id: customer.userId }, { phone: "+923001234567" });
    await api()
      .post("/api/v1/loyalty-cards/join")
      .set(bearer(customer.token))
      .send({ programId: program.body.data._id });

    const queued = await api().post(as("/exports")).set(bearer(a.ownerToken));
    expect(queued.status).toBe(202);
    expect(queued.body.data.status).toBe("QUEUED");
    expect(queued.body.data.fileKey).toBeUndefined();

    expect(await processExports()).toBe(1);
    expect(await processExports()).toBe(0);

    const list = await api().get(as("/exports")).set(bearer(a.ownerToken));
    expect(list.body.data[0]).toMatchObject({ status: "DONE", rows: 1 });

    const file = await api()
      .get(as(`/exports/${queued.body.data._id}/file`))
      .set(bearer(a.ownerToken))
      .buffer(true)
      .parse((res, done) => {
        let text = "";
        res.on("data", (chunk: Buffer) => (text += chunk.toString("utf8")));
        res.on("end", () => done(null, text));
      });
    expect(file.status).toBe(200);
    expect(file.headers["content-disposition"]).toContain("customers-");
    const text = file.body as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"Ayesha"');
    expect(text).not.toContain("1234567");
    expect(text).not.toContain("ayesha@example.com");

    // Another business cannot fetch it, and staff cannot export.
    const other = await api()
      .get(`/api/v1/businesses/${b.businessId}/exports/${queued.body.data._id}/file`)
      .set(bearer(b.ownerToken));
    expect(other.status).toBe(404);
    const staff = await registerUser("cashier@example.com");
    await BusinessMember.create({
      userId: staff.userId,
      businessId: a.businessId,
      role: "STAFF",
      status: "ACTIVE",
    });
    expect((await api().post(as("/exports")).set(bearer(staff.token))).status).toBe(403);
  });

  it("builds the accountant's invoice export, and retries a job whose worker died", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const a = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
    await api()
      .post(`/api/v1/admin/businesses/${a.businessId}/invoices`)
      .set(bearer(root.token))
      .send({});

    const queued = await api().post("/api/v1/admin/exports").set(bearer(root.token)).send({});
    expect(queued.status).toBe(202);
    const notReady = await api()
      .get(`/api/v1/admin/exports/${queued.body.data._id}/file`)
      .set(bearer(root.token));
    expect(notReady.status).toBe(409);

    // A worker that claimed it and vanished: picked up again after a while.
    await ExportJob.updateOne(
      { _id: queued.body.data._id },
      { status: "RUNNING", claimedAt: new Date(Date.now() - 60 * 60_000), attempts: 1 },
    );
    expect(await processExports()).toBe(1);

    const file = await api()
      .get(`/api/v1/admin/exports/${queued.body.data._id}/file`)
      .set(bearer(root.token));
    expect(file.status).toBe(200);
    expect(file.text).toContain('"Invoice","Issued"');
    expect(file.text).toContain("Alpha Cafe");

    const support = await platformUser("help@example.com", "SUPPORT");
    expect((await api().post("/api/v1/admin/exports").set(bearer(support.token))).status).toBe(403);
  });
});
