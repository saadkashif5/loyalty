import request from "supertest";
import { expect } from "vitest";
import { createApp } from "@/app";
import { User } from "@/models";
import { base32Decode, generateTotp } from "@/utils/totp";
import type { PlatformRole } from "@taptapsell/constants";

const app = createApp();
export const api = () => request(app);

export const PASSWORD = "correct-horse-battery";

export async function registerUser(email: string, name = "Test User") {
  const res = await api().post("/api/v1/auth/register").send({ name, email, password: PASSWORD });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
    userId: res.body.data.user.id as string,
  };
}

/** A code for the next 30-second step: accepted, and newer than any code used just before. */
export function nextCode(secret: string): string {
  return generateTotp(base32Decode(secret), Date.now() + 30_000);
}

export function currentCode(secret: string): string {
  return generateTotp(base32Decode(secret));
}

/** Turns on two-step verification for the signed-in user; returns the secret and recovery codes. */
export async function enableMfa(token: string) {
  const setup = await api().post("/api/v1/auth/mfa/setup").set("Authorization", `Bearer ${token}`);
  expect(setup.status).toBe(200);
  const secret = setup.body.data.secret as string;

  const enable = await api()
    .post("/api/v1/auth/mfa/enable")
    .set("Authorization", `Bearer ${token}`)
    .send({ code: currentCode(secret) });
  expect(enable.status).toBe(200);

  return { secret, recoveryCodes: enable.body.data.recoveryCodes as string[] };
}

/** A platform team member with two-step verification already on. */
export async function platformUser(email: string, role: PlatformRole) {
  const user = await registerUser(email, `${role} user`);
  await User.updateOne({ _id: user.userId }, { platformRole: role });
  const mfa = await enableMfa(user.token);
  return { ...user, ...mfa };
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
