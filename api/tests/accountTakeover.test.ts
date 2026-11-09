import { describe, expect, it } from "vitest";
import { User } from "@/models";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, platformUser, registerUser } from "./helpers";

function lastCodeFor(email: string): string {
  const message = [...testOutbox()].reverse().find((m) => m.to === email);
  const code = message?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code emailed to ${email}`);
  return code;
}

async function signInByCode(email: string) {
  const req = await api().post("/api/v1/auth/email-code").send({ email });
  return api()
    .post("/api/v1/auth/email-code/verify")
    .send({ challengeId: req.body.data.challengeId, code: lastCodeFor(email) });
}

function refresh(refreshToken: string) {
  return api().post("/api/v1/auth/refresh").send({ refreshToken });
}

describe("pre-registered (squatted) accounts", () => {
  it("drop the squatter's password and sessions when the real owner proves the email", async () => {
    // Someone registers an address they do not own.
    const squatter = await registerUser("victim@example.com", "Squatter");

    // The owner of the inbox signs in by email code.
    const owner = await signInByCode("victim@example.com");
    expect(owner.body.data.status).toBe("SIGNED_IN");

    // The squatter can neither refresh nor sign in with their password any more.
    expect((await refresh(squatter.refreshToken)).status).toBe(401);
    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "victim@example.com", password: PASSWORD });
    expect(login.status).toBe(401);

    // The owner's own session still works.
    expect((await refresh(owner.body.data.refreshToken)).status).toBe(200);

    const user = await User.findOne({ email: "victim@example.com" }).select("+passwordHash");
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user!.passwordHash).toBeUndefined();
  });

  it("keeps a verified account's password when it signs in by code", async () => {
    await registerUser("verified@example.com");
    await User.updateOne({ email: "verified@example.com" }, { emailVerifiedAt: new Date() });

    await signInByCode("verified@example.com");
    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "verified@example.com", password: PASSWORD });
    expect(login.status).toBe(200);
  });
});

describe("turning on two-step verification", () => {
  it("ends every other session, which never passed the second factor", async () => {
    const first = await registerUser("mfa-sessions@example.com");
    const second = await api()
      .post("/api/v1/auth/login")
      .send({ email: "mfa-sessions@example.com", password: PASSWORD });
    expect(second.status).toBe(200);

    await enableMfa(first.token);

    expect((await refresh(second.body.data.refreshToken)).status).toBe(401);
    expect((await refresh(first.refreshToken)).status).toBe(200);
  });
});

describe("platform user management", () => {
  it("does not let an ADMIN suspend or sign out a SUPER_ADMIN", async () => {
    const superAdmin = await platformUser("super@example.com", "SUPER_ADMIN");
    const admin = await platformUser("admin@example.com", "ADMIN");

    const suspend = await api()
      .patch(`/api/v1/admin/customers/${superAdmin.userId}/status`)
      .set(bearer(admin.token))
      .send({ status: "SUSPENDED" });
    expect(suspend.status).toBe(403);

    const signOut = await api()
      .post(`/api/v1/admin/users/${superAdmin.userId}/sign-out`)
      .set(bearer(admin.token));
    expect(signOut.status).toBe(403);

    expect((await User.findById(superAdmin.userId))!.status).toBe("ACTIVE");
  });

  it("still lets an ADMIN suspend a customer, and a SUPER_ADMIN suspend an ADMIN", async () => {
    const superAdmin = await platformUser("super2@example.com", "SUPER_ADMIN");
    const admin = await platformUser("admin2@example.com", "ADMIN");
    const customer = await registerUser("customer@example.com");

    const byAdmin = await api()
      .patch(`/api/v1/admin/customers/${customer.userId}/status`)
      .set(bearer(admin.token))
      .send({ status: "SUSPENDED" });
    expect(byAdmin.status).toBe(200);

    const bySuper = await api()
      .patch(`/api/v1/admin/customers/${admin.userId}/status`)
      .set(bearer(superAdmin.token))
      .send({ status: "SUSPENDED" });
    expect(bySuper.status).toBe(200);
  });
});
