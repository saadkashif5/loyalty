import { describe, expect, it } from "vitest";
import { OtpChallenge, User } from "@/models";
import { testOutbox } from "@/services/email.service";
import { PASSWORD, api, bearer, enableMfa, registerUser } from "./helpers";

function lastCodeFor(email: string): string {
  const message = [...testOutbox()].reverse().find((m) => m.to === email);
  const code = message?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code emailed to ${email}`);
  return code;
}

async function requestCode(email: string) {
  const res = await api().post("/api/v1/auth/email-code").send({ email });
  return { res, challengeId: res.body.data?.challengeId as string };
}

function verify(challengeId: string, code: string, name?: string) {
  return api()
    .post("/api/v1/auth/email-code/verify")
    .send({ challengeId, code, ...(name ? { name } : {}) });
}

/** Lets the next request through the 60-second resend cooldown. */
async function skipCooldown(email: string) {
  // Straight to the collection: Mongoose treats createdAt as immutable.
  await OtpChallenge.collection.updateMany(
    { email },
    { $set: { createdAt: new Date(Date.now() - 120_000) } },
  );
}

describe("email code sign-up and sign-in", () => {
  it("creates an account on first use, after asking for a name", async () => {
    const { res, challengeId } = await requestCode("Zainab@Example.com");
    expect(res.status).toBe(200);
    expect(res.body.data.expiresInSeconds).toBe(300);

    const code = lastCodeFor("zainab@example.com");
    const needsName = await verify(challengeId, code);
    expect(needsName.body.data.status).toBe("NAME_REQUIRED");

    const signedUp = await verify(challengeId, code, "Zainab Ali");
    expect(signedUp.status).toBe(201);
    expect(signedUp.body.data.status).toBe("SIGNED_IN");
    expect(signedUp.body.data.created).toBe(true);

    const user = await User.findOne({ email: "zainab@example.com" }).select("+passwordHash");
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user!.passwordHash).toBeUndefined();

    const me = await api().get("/api/v1/users/me").set(bearer(signedUp.body.data.accessToken));
    expect(me.body.data.name).toBe("Zainab Ali");

    // A code works once.
    expect((await verify(challengeId, code, "Zainab Ali")).body.error.code).toBe("CODE_EXPIRED");
  });

  it("signs an existing account straight in", async () => {
    await registerUser("returning@example.com", "Returning");
    const { challengeId } = await requestCode("returning@example.com");

    const res = await verify(challengeId, lastCodeFor("returning@example.com"));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SIGNED_IN");
    expect(res.body.data.created).toBe(false);
  });

  it("answers the same way whether or not the account exists", async () => {
    await registerUser("known@example.com");
    const known = await requestCode("known@example.com");
    const unknown = await requestCode("unknown@example.com");

    expect(known.res.status).toBe(unknown.res.status);
    expect(Object.keys(known.res.body.data).sort()).toEqual(
      Object.keys(unknown.res.body.data).sort(),
    );
  });

  it("stops after five wrong codes, even if the sixth is right", async () => {
    const { challengeId } = await requestCode("guess@example.com");
    const code = lastCodeFor("guess@example.com");
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i += 1) {
      expect((await verify(challengeId, wrong, "Guess")).body.error.code).toBe("INVALID_CODE");
    }
    const sixth = await verify(challengeId, code, "Guess");
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("refuses expired codes, superseded codes and quick resends", async () => {
    const first = await requestCode("timing@example.com");
    const firstCode = lastCodeFor("timing@example.com");

    const tooSoon = await requestCode("timing@example.com");
    expect(tooSoon.res.status).toBe(429);
    expect(tooSoon.res.body.error.code).toBe("CODE_COOLDOWN");

    await skipCooldown("timing@example.com");
    const second = await requestCode("timing@example.com");
    // Only the newest code works.
    expect((await verify(first.challengeId, firstCode, "T")).body.error.code).toBe("CODE_EXPIRED");

    await OtpChallenge.updateOne(
      { _id: second.challengeId },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    const late = await verify(second.challengeId, lastCodeFor("timing@example.com"), "T");
    expect(late.body.error.code).toBe("CODE_EXPIRED");
  });

  it("stores only a keyed hash of the code", async () => {
    const { challengeId } = await requestCode("hash@example.com");
    const stored = await OtpChallenge.findById(challengeId);
    expect(stored!.codeHash).not.toContain(lastCodeFor("hash@example.com"));
    expect(stored!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("still asks for the authenticator code when two-step verification is on", async () => {
    const owner = await registerUser("owner2@example.com");
    await enableMfa(owner.token);

    const { challengeId } = await requestCode("owner2@example.com");
    const res = await verify(challengeId, lastCodeFor("owner2@example.com"));
    expect(res.body.data.status).toBe("MFA_REQUIRED");
    expect(res.body.data.accessToken).toBeUndefined();
  });

  it("gives email-code accounts no way in by password", async () => {
    const { challengeId } = await requestCode("nopass@example.com");
    await verify(challengeId, lastCodeFor("nopass@example.com"), "No Pass");

    const login = await api()
      .post("/api/v1/auth/login")
      .send({ email: "nopass@example.com", password: PASSWORD });
    expect(login.status).toBe(401);
  });
});
