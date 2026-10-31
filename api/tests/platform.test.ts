import { describe, expect, it } from "vitest";
import { Business, BusinessMember, User } from "@/models";
import { base32Decode, base32Encode, generateTotp } from "@/utils/totp";
import { open, seal } from "@/utils/secretBox";
import {
  PASSWORD,
  api,
  bearer,
  currentCode,
  enableMfa,
  nextCode,
  platformUser,
  registerUser,
} from "./helpers";

const NEW_BUSINESS = {
  business: { name: "Karachi Bakers", category: "BAKERY" },
  owner: { name: "Hina Siddiqui", email: "hina@example.com", phone: "0321 7654321" },
};

function tokenFrom(inviteUrl: string): string {
  return inviteUrl.split("/invite/")[1];
}

async function inviteBusiness(adminToken: string, body: Record<string, unknown> = NEW_BUSINESS) {
  const res = await api().post("/api/v1/admin/businesses").set(bearer(adminToken)).send(body);
  expect(res.status).toBe(201);
  return {
    businessId: res.body.data.business._id as string,
    invitationId: res.body.data.invitation.id as string,
    token: tokenFrom(res.body.data.inviteUrl),
  };
}

describe("TOTP", () => {
  // RFC 6238 Appendix B, SHA-1, 8 digits.
  const rfcSecret = Buffer.from("12345678901234567890");
  const vectors: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it.each(vectors)("matches the RFC 6238 test vector at %i seconds", (seconds, expected) => {
    expect(generateTotp(rfcSecret, seconds * 1000, 8)).toBe(expected);
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from("taptapsell-secret!!!");
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });

  it("seals secrets so they can be opened but not altered", () => {
    const sealed = seal("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(open(sealed)).toBe("JBSWY3DPEHPK3PXP");

    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => open(tampered)).toThrow();
  });
});

describe("two-step verification", () => {
  it("is required before any admin action, then gates every sign-in", async () => {
    const admin = await registerUser("root@example.com");
    await User.updateOne({ _id: admin.userId }, { platformRole: "SUPER_ADMIN" });

    const blocked = await api().get("/api/v1/admin/overview").set(bearer(admin.token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("MFA_SETUP_REQUIRED");

    const { secret, recoveryCodes } = await enableMfa(admin.token);
    expect(recoveryCodes).toHaveLength(10);
    expect((await api().get("/api/v1/admin/overview").set(bearer(admin.token))).status).toBe(200);

    // The password alone now returns a challenge, not tokens.
    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "root@example.com", password: PASSWORD });
    expect(login.body.data.mfaRequired).toBe(true);
    expect(login.body.data.accessToken).toBeUndefined();
    const mfaToken = login.body.data.mfaToken as string;

    // The challenge is not an access token.
    expect((await api().get("/api/v1/users/me").set(bearer(mfaToken))).status).toBe(401);

    const wrong = await api().post("/api/v1/auth/login/mfa").send({ mfaToken, code: "000000" });
    expect(wrong.status).toBe(401);

    const code = nextCode(secret);
    const ok = await api().post("/api/v1/auth/login/mfa").send({ mfaToken, code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toEqual(expect.any(String));

    // The same code cannot be used twice.
    const replay = await api().post("/api/v1/auth/login/mfa").send({ mfaToken, code });
    expect(replay.status).toBe(401);

    // Recovery codes work once each.
    const recovery = { mfaToken, recoveryCode: recoveryCodes[0] };
    expect((await api().post("/api/v1/auth/login/mfa").send(recovery)).status).toBe(200);
    expect((await api().post("/api/v1/auth/login/mfa").send(recovery)).status).toBe(401);
  });

  it("cannot be turned off by a platform user", async () => {
    const admin = await platformUser("ops@example.com", "ADMIN");
    const res = await api()
      .post("/api/v1/auth/mfa/disable")
      .set(bearer(admin.token))
      .send({ code: nextCode(admin.secret) });

    expect(res.status).toBe(403);
  });

  it("can be turned off by a customer who opted in", async () => {
    const customer = await registerUser("optional@example.com");
    const { secret } = await enableMfa(customer.token);

    const res = await api()
      .post("/api/v1/auth/mfa/disable")
      .set(bearer(customer.token))
      .send({ code: nextCode(secret) });

    expect(res.status).toBe(200);
    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "optional@example.com", password: PASSWORD });
    expect(login.body.data.mfaRequired).toBe(false);
  });
});

describe("platform permissions", () => {
  it("lets support read but not change", async () => {
    const support = await platformUser("support@example.com", "SUPPORT");

    expect((await api().get("/api/v1/admin/businesses").set(bearer(support.token))).status).toBe(
      200,
    );
    const create = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(support.token))
      .send(NEW_BUSINESS);
    expect(create.status).toBe(403);
  });

  it("keeps finance away from customer accounts", async () => {
    const finance = await platformUser("finance@example.com", "FINANCE");
    expect((await api().get("/api/v1/admin/customers").set(bearer(finance.token))).status).toBe(
      403,
    );
  });

  it("refuses ordinary users", async () => {
    const user = await registerUser("someone@example.com");
    expect((await api().get("/api/v1/admin/businesses").set(bearer(user.token))).status).toBe(403);
  });
});

describe("owner invitations", () => {
  it("creates a pending business that its owner activates by accepting", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const invite = await inviteBusiness(admin.token);

    expect((await Business.findById(invite.businessId))!.status).toBe("PENDING");

    const preview = await api().get(`/api/v1/invitations/${invite.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.business.name).toBe("Karachi Bakers");
    expect(preview.body.data.accountExists).toBe(false);

    const noPassword = await api().post(`/api/v1/invitations/${invite.token}/accept`).send({});
    expect(noPassword.status).toBe(400);

    const accept = await api()
      .post(`/api/v1/invitations/${invite.token}/accept`)
      .send({ password: PASSWORD });
    expect(accept.status).toBe(201);
    expect(accept.body.data.mfaSetupRequired).toBe(true);
    const ownerToken = accept.body.data.accessToken as string;

    const owner = await User.findOne({ email: "hina@example.com" });
    expect(owner!.phone).toBe("+923217654321");
    expect((await Business.findById(invite.businessId))!.status).toBe("ACTIVE");

    // Owners must set up two-step verification before managing the business.
    const gated = await api()
      .get(`/api/v1/businesses/${invite.businessId}`)
      .set(bearer(ownerToken));
    expect(gated.body.error.code).toBe("MFA_SETUP_REQUIRED");
    await enableMfa(ownerToken);
    expect(
      (await api().get(`/api/v1/businesses/${invite.businessId}`).set(bearer(ownerToken))).status,
    ).toBe(200);

    const reuse = await api()
      .post(`/api/v1/invitations/${invite.token}/accept`)
      .send({ password: PASSWORD });
    expect(reuse.status).toBe(404);
    expect(reuse.body.error.code).toBe("INVITATION_INVALID");
  });

  it("makes an existing account sign in before accepting", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const customer = await registerUser("hina@example.com", "Hina");
    const invite = await inviteBusiness(admin.token);

    const anonymous = await api()
      .post(`/api/v1/invitations/${invite.token}/accept`)
      .send({ password: "someone-elses-guess" });
    expect(anonymous.status).toBe(409);
    expect(anonymous.body.error.code).toBe("ACCOUNT_EXISTS");

    const signedIn = await api()
      .post(`/api/v1/invitations/${invite.token}/accept`)
      .set(bearer(customer.token))
      .send({});
    expect(signedIn.status).toBe(201);
    expect(signedIn.body.data.accessToken).toBeUndefined();

    const member = await BusinessMember.findOne({
      userId: customer.userId,
      businessId: invite.businessId,
    });
    expect(member!.role).toBe("OWNER");
  });

  it("refuses an invitation opened while signed in as someone else", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const stranger = await registerUser("stranger@example.com");
    const invite = await inviteBusiness(admin.token);

    const res = await api()
      .post(`/api/v1/invitations/${invite.token}/accept`)
      .set(bearer(stranger.token))
      .send({ password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it("invalidates the old link on resend, and blocks a revoked invitation", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const invite = await inviteBusiness(admin.token);

    const resent = await api()
      .post(`/api/v1/admin/invitations/${invite.invitationId}/resend`)
      .set(bearer(admin.token));
    expect(resent.status).toBe(200);
    expect(resent.body.data.invitation.sendCount).toBe(2);

    expect((await api().get(`/api/v1/invitations/${invite.token}`)).status).toBe(404);
    const newToken = tokenFrom(resent.body.data.inviteUrl);
    expect((await api().get(`/api/v1/invitations/${newToken}`)).status).toBe(200);

    await api()
      .post(`/api/v1/admin/invitations/${invite.invitationId}/revoke`)
      .set(bearer(admin.token));
    expect((await api().get(`/api/v1/invitations/${newToken}`)).status).toBe(404);
  });

  it("no longer lets anyone create a business themselves", async () => {
    const user = await registerUser("diy@example.com");
    const res = await api()
      .post("/api/v1/businesses")
      .set(bearer(user.token))
      .send({ name: "Self Serve", category: "CAFE" });
    expect(res.status).toBe(404);
  });
});

describe("leads", () => {
  it("accepts a public request and lets the team convert it", async () => {
    const lead = await api().post("/api/v1/leads").send({
      businessName: "Lahore Grill",
      contactName: "Usman",
      phone: "0300 1234567",
      city: "Lahore",
      category: "RESTAURANT",
    });
    expect(lead.status).toBe(201);
    const leadId = lead.body.data.id as string;

    const badPhone = await api().post("/api/v1/leads").send({
      businessName: "X",
      contactName: "Y",
      phone: "12345",
      city: "Lahore",
      category: "CAFE",
    });
    expect(badPhone.status).toBe(400);

    const admin = await platformUser("admin@example.com", "ADMIN");
    const list = await api().get("/api/v1/admin/leads").set(bearer(admin.token));
    expect(list.body.data[0].phone).toBe("+923001234567");

    const noted = await api()
      .patch(`/api/v1/admin/leads/${leadId}`)
      .set(bearer(admin.token))
      .send({ status: "CONTACTED", note: "Called, wants a demo on Monday" });
    expect(noted.body.data.status).toBe("CONTACTED");

    await inviteBusiness(admin.token, { ...NEW_BUSINESS, leadId });
    const after = await api().get("/api/v1/admin/leads").set(bearer(admin.token));
    expect(after.body.data[0].status).toBe("CONVERTED");
  });
});

describe("platform team and sessions", () => {
  it("lets a super admin manage the team, but not their own role", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const colleague = await registerUser("colleague@example.com");

    const added = await api()
      .post("/api/v1/admin/team")
      .set(bearer(root.token))
      .send({ email: "colleague@example.com", platformRole: "SUPPORT" });
    expect(added.status).toBe(201);

    const self = await api()
      .patch(`/api/v1/admin/team/${root.userId}`)
      .set(bearer(root.token))
      .send({ platformRole: "ADMIN" });
    expect(self.status).toBe(403);

    // Removing someone from the team ends their sessions.
    await api()
      .patch(`/api/v1/admin/team/${colleague.userId}`)
      .set(bearer(root.token))
      .send({ platformRole: null });
    const refresh = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: colleague.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("lists sessions and signs out the others", async () => {
    const first = await registerUser("traveller@example.com");
    const second = await api()
      .post("/api/v1/auth/login")
      .send({ email: "traveller@example.com", password: PASSWORD });

    const sessions = await api().get("/api/v1/auth/sessions").set(bearer(first.token));
    expect(sessions.body.data).toHaveLength(2);
    expect(sessions.body.data.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    await api().post("/api/v1/auth/sessions/revoke-others").set(bearer(first.token));

    const refreshOther = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: second.body.data.refreshToken });
    expect(refreshOther.status).toBe(401);
    // The signed-out device trying again must not sign out this one.
    expect(
      (await api().get("/api/v1/auth/sessions").set(bearer(first.token))).body.data,
    ).toHaveLength(1);
    const refreshMine = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: first.refreshToken });
    expect(refreshMine.status).toBe(200);
  });

  it("revokes every session when a rotated refresh token is reused", async () => {
    const user = await registerUser("stolen@example.com");
    const rotated = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(rotated.status).toBe(200);

    // Someone replays the old token: both copies are now untrusted.
    const replay = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(replay.status).toBe(401);
    const legit = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.data.refreshToken });
    expect(legit.status).toBe(401);
  });

  it("ends a user's sessions when they are suspended", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const customer = await registerUser("suspend-me@example.com");

    await api()
      .patch(`/api/v1/admin/customers/${customer.userId}/status`)
      .set(bearer(admin.token))
      .send({ status: "SUSPENDED" });

    expect((await api().get("/api/v1/users/me").set(bearer(customer.token))).status).toBe(401);
    const refresh = await api()
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: customer.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("reports whether two-step verification is required", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const status = await api().get("/api/v1/auth/mfa").set(bearer(admin.token));
    expect(status.body.data).toEqual({ enabled: true, required: true });
    expect(currentCode(admin.secret)).toMatch(/^\d{6}$/);
  });
});

describe("admin console data", () => {
  it("searches businesses and shows one in detail", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const invite = await inviteBusiness(admin.token);
    await inviteBusiness(admin.token, {
      business: { name: "Quetta Cafe", category: "CAFE" },
      owner: { name: "Zara", email: "zara@example.com" },
    });

    const search = await api().get("/api/v1/admin/businesses?q=karachi").set(bearer(admin.token));
    expect(search.body.data).toHaveLength(1);
    expect(search.body.meta.total).toBe(1);

    // Search text is treated literally, never as a pattern.
    const regex = await api().get("/api/v1/admin/businesses?q=.*").set(bearer(admin.token));
    expect(regex.body.data).toHaveLength(0);

    const detail = await api()
      .get(`/api/v1/admin/businesses/${invite.businessId}`)
      .set(bearer(admin.token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.business.name).toBe("Karachi Bakers");
    expect(detail.body.data.invitations[0].status).toBe("PENDING");
    expect(detail.body.data.counts).toEqual({ customers: 0, stamps: 0, redemptions: 0 });
  });

  it("lists the stamper fleet to viewers and mints only with device permission", async () => {
    const admin = await platformUser("admin@example.com", "ADMIN");
    const support = await platformUser("support@example.com", "SUPPORT");

    const minted = await api()
      .post("/api/v1/admin/devices")
      .set(bearer(admin.token))
      .send({ quantity: 3 });
    expect(minted.status).toBe(201);
    // Activation codes are visible once, at mint time only.
    expect(minted.body.data[0].activationCode).toEqual(expect.any(String));

    const fleet = await api()
      .get("/api/v1/admin/devices?status=UNASSIGNED")
      .set(bearer(support.token));
    expect(fleet.body.meta.total).toBe(3);
    expect(fleet.body.data[0].activationCode).toBeUndefined();

    const supportMint = await api()
      .post("/api/v1/admin/devices")
      .set(bearer(support.token))
      .send({ quantity: 1 });
    expect(supportMint.status).toBe(403);
  });
});

describe("client address forwarding", () => {
  const SECRET = "test-internal-secret-that-is-long-enough";

  it("trusts the forwarded address only with the shared secret", async () => {
    await registerUser("forwarded@example.com");
    const loginWith = (headers: Record<string, string>) =>
      api()
        .post("/api/v1/auth/login")
        .set(headers)
        .send({ email: "forwarded@example.com", password: PASSWORD });

    const trusted = await loginWith({
      "X-Internal-Secret": SECRET,
      "X-Client-IP": "203.0.113.7",
      "X-Client-User-Agent": "Mozilla/5.0 (Linux; Android 14)",
    });
    const spoofed = await loginWith({
      "X-Internal-Secret": "wrong",
      "X-Client-IP": "198.51.100.9",
    });

    const sessions = await api()
      .get("/api/v1/auth/sessions")
      .set(bearer(trusted.body.data.accessToken));
    const ips = sessions.body.data.map((s: { ip: string }) => s.ip);
    const agents = sessions.body.data.map((s: { userAgent: string | null }) => s.userAgent);

    expect(ips).toContain("203.0.113.7");
    expect(ips).not.toContain("198.51.100.9");
    expect(agents).toContain("Mozilla/5.0 (Linux; Android 14)");
    expect(spoofed.status).toBe(200);
  });
});
