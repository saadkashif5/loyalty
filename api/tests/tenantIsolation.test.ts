import type { Router } from "express";
import mongoose, { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Branch, Reward } from "@/models";
import { runAcrossTenants, runAsTenant } from "@/models/tenantGuard";
import businessRoutes from "@/routes/business.routes";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
  regexp?: RegExp;
}

/** Every route on the business router, including its sub-routers. */
function listRoutes(router: { stack: RouteLayer[] }, prefix = ""): Array<[string, string]> {
  return router.stack.flatMap((layer): Array<[string, string]> => {
    if (layer.route) {
      const path = `${prefix}${layer.route.path}`.replace(/\/$/, "");
      return Object.keys(layer.route.methods).map((method) => [method, path]);
    }
    if (layer.handle?.stack) {
      // Express 4 keeps a mount path only as a regular expression: /^\/branches\/?(?=\/|$)/i
      const mount = (layer.regexp?.source ?? "")
        .replace(/^\^/, "")
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
        .replace(/\\\//g, "/");
      return listRoutes(layer.handle as { stack: RouteLayer[] }, `${prefix}${mount}`);
    }
    return [];
  });
}

const ALL_ROUTES = listRoutes(businessRoutes as unknown as Router & { stack: RouteLayer[] });

// An invited staff member is not a member yet, so these cannot check membership.
// They only ever act on the caller's own invitation.
const INVITEE_ROUTES = ["/members/accept", "/members/decline"];
const ROUTES = ALL_ROUTES.filter(([, path]) => !INVITEE_ROUTES.includes(path));

function fillParams(path: string) {
  return path.replace(/:\w+/g, new Types.ObjectId().toString());
}

function call(method: string, path: string) {
  const agent = api() as unknown as Record<
    string,
    (url: string) => ReturnType<ReturnType<typeof api>["get"]>
  >;
  return agent[method]!(path);
}

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

async function twoBusinesses() {
  const root = await platformUser("root@example.com", "SUPER_ADMIN");
  const a = await onboard(root.token, "Alpha Cafe", "alpha@example.com");
  const b = await onboard(root.token, "Beta Bakery", "beta@example.com");
  return { root, a, b };
}

describe("tenant guard on the data layer", () => {
  const A = new Types.ObjectId().toString();
  const B = new Types.ObjectId().toString();

  // Queries run when awaited, so the await must be inside the tenant.
  function asA<T>(fn: () => PromiseLike<T>): Promise<T> {
    return runAsTenant(A, async () => await fn());
  }

  function seedBranches() {
    return Promise.all([
      Branch.create({ businessId: A, name: "Alpha branch" }),
      Branch.create({ businessId: B, name: "Beta branch" }),
    ]);
  }

  it("covers every collection that has a businessId", async () => {
    const scoped = mongoose
      .modelNames()
      .map((name) => mongoose.model(name))
      .filter((model) => model.schema.path("businessId"));
    expect(scoped.length).toBeGreaterThan(10);

    for (const model of scoped) {
      const query = model.find();
      await asA(() => query.exec());
      expect(String(query.getFilter().businessId), model.modelName).toBe(A);
    }
  });

  it("hides another business's documents from reads that forget the filter", async () => {
    const [, beta] = await seedBranches();
    expect(await asA(() => Branch.findById(beta._id))).toBeNull();
    const found = await asA(() => Branch.find());
    expect(found.map((b) => b.name)).toEqual(["Alpha branch"]);
    expect(await asA(() => Branch.countDocuments())).toBe(1);
  });

  it("stops writes that forget the filter", async () => {
    const [, beta] = await seedBranches();
    await asA(() => Branch.updateOne({ _id: beta._id }, { name: "Stolen" }));
    await asA(() => Branch.deleteOne({ _id: beta._id }));
    expect((await Branch.findById(beta._id))!.name).toBe("Beta branch");
  });

  it("refuses a query that names another business, and saving its documents", async () => {
    const [, beta] = await seedBranches();
    await expect(asA(() => Branch.find({ businessId: B }))).rejects.toThrow();
    beta.name = "Stolen";
    await expect(asA(() => beta.save())).rejects.toThrow();
    await expect(asA(() => Branch.create({ businessId: B, name: "Planted" }))).rejects.toThrow();
  });

  it("limits aggregations", async () => {
    await seedBranches();
    const rows = await asA(() => Branch.aggregate([{ $count: "n" }]));
    expect(rows).toEqual([{ n: 1 }]);
  });

  it("leaves code outside a tenant alone, and allows a deliberate exception", async () => {
    await seedBranches();
    expect(await Branch.countDocuments()).toBe(2);
    expect(await asA(() => runAcrossTenants(async () => await Branch.countDocuments()))).toBe(2);
  });
});

describe("every business route", () => {
  it("finds the routes", () => {
    expect(ALL_ROUTES.length).toBeGreaterThanOrEqual(40);
    expect(ROUTES).toContainEqual(["get", "/billing"]);
    expect(ROUTES).toContainEqual(["get", "/branches"]);
  });

  it("refuses a request with no token", async () => {
    const id = new Types.ObjectId().toString();
    for (const [method, path] of ROUTES) {
      const res = await call(method, `/api/v1/businesses/${id}${fillParams(path)}`);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("refuses the owner of another business", async () => {
    const { a, b } = await twoBusinesses();
    for (const [method, path] of ROUTES) {
      const res = await call(method, `/api/v1/businesses/${b.businessId}${fillParams(path)}`).set(
        bearer(a.ownerToken),
      );
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("lets an invitation route act only on the caller's own invitation", async () => {
    const { a, b } = await twoBusinesses();
    for (const path of INVITEE_ROUTES) {
      const res = await api()
        .post(`/api/v1/businesses/${b.businessId}${path}`)
        .set(bearer(a.ownerToken));
      expect(res.status, path).toBe(404);
    }
    const res = await api()
      .post("/api/v1/businesses/not-an-id/members/accept")
      .set(bearer(a.ownerToken));
    expect(res.status).toBe(400);
  });

  it("answers a malformed business id with an error, not a crash", async () => {
    const { a } = await twoBusinesses();
    for (const [method, path] of ROUTES) {
      const res = await call(method, `/api/v1/businesses/not-an-id${fillParams(path)}`).set(
        bearer(a.ownerToken),
      );
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });
});

describe("another business's records through your own business", () => {
  it("does not find them", async () => {
    const { a, b } = await twoBusinesses();
    const branch = await Branch.create({ businessId: b.businessId, name: "Theirs" });
    const reward = await Reward.create({
      businessId: b.businessId,
      programId: new Types.ObjectId(),
      name: "Theirs",
      type: "FREE_ITEM",
      requiredStamps: 5,
    });

    const base = `/api/v1/businesses/${a.businessId}`;
    const asOwner = bearer(a.ownerToken);
    const edit = await api()
      .patch(`${base}/branches/${branch._id}`)
      .set(asOwner)
      .send({ name: "Mine" });
    expect(edit.status).toBe(404);
    const rewardEdit = await api()
      .patch(`${base}/rewards/${reward._id}`)
      .set(asOwner)
      .send({ name: "Mine" });
    expect(rewardEdit.status).toBe(404);
    expect((await Branch.findById(branch._id))!.name).toBe("Theirs");
  });
});
