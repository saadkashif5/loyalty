import { describe, expect, it } from "vitest";
import { BusinessInvitation, BusinessMember, PasswordReset, User } from "@/models";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

const NEW_PASSWORD = "a-brand-new-password-1";

function forgot(email: string, app = "dashboard") {
  return api().post("/api/v1/auth/password/forgot").send({ email, app });
}

function linkFor(email: string): string {
  const mail = [...testOutbox()].reverse().find((m) => m.to === email && /Reset/.test(m.subject));
  return mail?.text.match(/https?:\/\/\S+/)?.[0] ?? "";
}

function tokenFrom(link: string) {
  return new URL(link).searchParams.get("token") ?? "";
}

describe("password reset", () => {
  it("emails a link that sets a new password once, and signs out everywhere", async () => {
    const user = await registerUser("forgot@example.com", "Forgetful");
    expect((await forgot("forgot@example.com")).status).toBe(200);

    const link = linkFor("forgot@example.com");
    expect(link.startsWith("http://localhost:3000/reset-password?token=")).toBe(true);

    const reset = await api()
      .post("/api/v1/auth/password/reset")
      .send({ token: tokenFrom(link), password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    // The old session is gone, the old password fails, the new one works.
    expect((await api().get("/api/v1/auth/sessions").set(bearer(user.token))).body.data).toEqual(
      [],
    );
    const login = (password: string) =>
      api().post("/api/v1/auth/login").send({ email: "forgot@example.com", password });
    expect((await login(PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);

    const again = await api()
      .post("/api/v1/auth/password/reset")
      .send({ token: tokenFrom(link), password: "yet-another-password" });
    expect(again.status).toBe(400);
    expect(testOutbox().some((m) => m.subject.includes("password was changed"))).toBe(true);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    const before = testOutbox().length;
    const res = await forgot("nobody@example.com");
    expect(res.status).toBe(200);
    expect(testOutbox().length).toBe(before);
  });

  it("refuses an expired link, and keeps only the newest one", async () => {
    await registerUser("twice@example.com");
    await forgot("twice@example.com");
    const first = tokenFrom(linkFor("twice@example.com"));
    await forgot("twice@example.com");
    const second = tokenFrom(linkFor("twice@example.com"));

    const use = (token: string) =>
      api().post("/api/v1/auth/password/reset").send({ token, password: NEW_PASSWORD });
    expect((await use(first)).status).toBe(400);

    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await use(second)).status).toBe(400);
  });

  it("sends console links only to the platform team, and they still need two-step", async () => {
    await registerUser("owner-only@example.com");
    await forgot("owner-only@example.com", "console");
    expect(linkFor("owner-only@example.com")).toBe("");

    await platformUser("team@example.com", "SUPPORT");
    await forgot("team@example.com", "console");
    const link = linkFor("team@example.com");
    expect(link.startsWith("http://localhost:3001/reset-password?token=")).toBe(true);
    await api()
      .post("/api/v1/auth/password/reset")
      .send({ token: tokenFrom(link), password: NEW_PASSWORD });

    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "team@example.com", password: NEW_PASSWORD });
    expect(login.body.data.mfaRequired).toBe(true);
  });

  it("sends nothing for a suspended account", async () => {
    const user = await registerUser("gone@example.com");
    await User.updateOne({ _id: user.userId }, { status: "SUSPENDED" });
    await forgot("gone@example.com");
    expect(linkFor("gone@example.com")).toBe("");
  });
});

describe("invitation emails", () => {
  it("emails the owner their invitation link, and again on resend", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const res = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(root.token))
      .send({
        business: { name: "Quetta Cafe", category: "CAFE" },
        owner: { name: "Owner", email: "new-owner@example.com" },
      });
    const mail = testOutbox().find((m) => m.to === "new-owner@example.com");
    expect(mail?.subject).toContain("Quetta Cafe");
    expect(mail?.text).toContain(res.body.data.inviteUrl);

    const invitation = await BusinessInvitation.findOne();
    const resent = await api()
      .post(`/api/v1/admin/invitations/${invitation!._id}/resend`)
      .set(bearer(root.token));
    expect(testOutbox().filter((m) => m.to === "new-owner@example.com")).toHaveLength(2);
    expect(testOutbox().at(-1)?.text).toContain(resent.body.data.inviteUrl);
  });

  it("tells a staff member they were invited", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const invite = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(root.token))
      .send({
        business: { name: "Sialkot Sweets", category: "CAFE" },
        owner: { name: "Owner", email: "owner@example.com" },
      });
    const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
    const accepted = await api()
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ password: PASSWORD });
    const ownerToken = accepted.body.data.accessToken as string;
    await enableMfa(ownerToken);
    await registerUser("cashier@example.com", "Cashier");

    const res = await api()
      .post(`/api/v1/businesses/${invite.body.data.business._id}/members`)
      .set(bearer(ownerToken))
      .send({ email: "cashier@example.com", role: "STAFF" });
    expect(res.status).toBe(201);
    expect(await BusinessMember.countDocuments({ status: "INVITED" })).toBe(1);
    const mail = testOutbox().find((m) => m.to === "cashier@example.com");
    expect(mail?.subject).toContain("Sialkot Sweets");
  });
});
