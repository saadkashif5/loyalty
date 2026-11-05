import type { Router } from "express";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { NfcDevice, PaymentProof, User } from "@/models";
import { jsonReplacer } from "@/models/serialize";
import adminRoutes from "@/modules/admin/admin.routes";
import businessRoutes from "@/routes/business.routes";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
  regexp?: RegExp;
}

/** Every GET route on a router, including its sub-routers. */
function getRoutes(router: { stack: RouteLayer[] }, prefix = ""): string[] {
  return router.stack.flatMap((layer): string[] => {
    if (layer.route) {
      return layer.route.methods.get ? [`${prefix}${layer.route.path}`.replace(/\/$/, "")] : [];
    }
    if (layer.handle?.stack) {
      const mount = (layer.regexp?.source ?? "")
        .replace(/^\^/, "")
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
        .replace(/\\\//g, "/");
      return getRoutes(layer.handle as { stack: RouteLayer[] }, `${prefix}${mount}`);
    }
    return [];
  });
}

const SECRET_KEYS = [
  "passwordHash",
  "secret",
  "pendingSecret",
  "lastUsedStep",
  "recoveryCodeHashes",
  "activationCode",
  "tokenHash",
  "codeHash",
  "fileKey",
  "__v",
];

function keysIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysIn(v, found));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysIn(child, found);
    }
  }
  return found;
}

describe("documents sent as JSON", () => {
  it("never carry secrets, even when a query selected them", async () => {
    const created = await User.create({
      name: "Sana",
      email: "sana@example.com",
      passwordHash: "argon-hash",
      mfa: { enabled: true, secret: "sealed", recoveryCodeHashes: ["a", "b"], lastUsedStep: 9 },
    });
    const user = await User.findById(created._id).select(
      "+passwordHash +mfa.secret +mfa.recoveryCodeHashes +mfa.lastUsedStep",
    );
    expect(user!.passwordHash).toBe("argon-hash");
    const json = JSON.parse(JSON.stringify(user));
    expect(json.passwordHash).toBeUndefined();
    expect(json.mfa).toEqual({ enabled: true });
    expect(json.__v).toBeUndefined();
    expect(json.email).toBe("sana@example.com");

    const device = await NfcDevice.create({ deviceIdentifier: "S-1", activationCode: "123456" });
    const loaded = await NfcDevice.findById(device._id).select("+activationCode");
    expect(JSON.parse(JSON.stringify(loaded)).activationCode).toBeUndefined();

    const proof = new PaymentProof({ fileKey: "proofs/abc.pdf", mimeType: "application/pdf" });
    expect(JSON.parse(JSON.stringify(proof)).fileKey).toBeUndefined();
  });

  it("strips secret names from plain objects in responses", () => {
    const body = { user: { email: "a@b.c", passwordHash: "x" }, rows: [{ tokenHash: "y", n: 1 }] };
    expect(JSON.parse(JSON.stringify(body, jsonReplacer))).toEqual({
      user: { email: "a@b.c" },
      rows: [{ n: 1 }],
    });
  });
});

describe("every GET route", () => {
  it("returns no secret fields to an owner or the platform team", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const invite = await api()
      .post("/api/v1/admin/businesses")
      .set(bearer(root.token))
      .send({
        business: { name: "Alpha Cafe", category: "CAFE" },
        owner: { name: "O", email: "o@example.com" },
      });
    const businessId = invite.body.data.business._id as string;
    const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
    const accepted = await api()
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ password: PASSWORD });
    const owner = accepted.body.data.accessToken as string;
    await enableMfa(owner);
    await NfcDevice.create({
      deviceIdentifier: "S-2",
      activationCode: "654321",
      businessId,
      status: "ACTIVE",
    });

    const fill = (path: string) =>
      path.replace(":businessId", businessId).replace(/:\w+/g, new Types.ObjectId().toString());

    const calls = [
      ...getRoutes(businessRoutes as unknown as Router & { stack: RouteLayer[] }).map((p) => ({
        url: `/api/v1/businesses/${businessId}${fill(p)}`,
        token: owner,
      })),
      ...getRoutes(adminRoutes as unknown as Router & { stack: RouteLayer[] }).map((p) => ({
        url: `/api/v1/admin${fill(p)}`,
        token: root.token,
      })),
      { url: "/api/v1/users/me", token: owner },
      { url: "/api/v1/businesses", token: owner },
    ];
    expect(calls.length).toBeGreaterThan(30);

    let ok = 0;
    for (const call of calls) {
      const res = await api().get(call.url).set(bearer(call.token));
      if (res.status === 200) ok += 1;
      if (!res.headers["content-type"]?.includes("json")) continue;
      const leaked = SECRET_KEYS.filter((k) => keysIn(res.body).has(k));
      expect(leaked, call.url).toEqual([]);
    }
    expect(ok).toBeGreaterThan(30);
  });
});
