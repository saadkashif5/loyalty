import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { AuditLog, LoyaltyCard, User } from "@/models";
import { PASSWORD, api, bearer, enableMfa, platformUser } from "./helpers";

async function onboard(rootToken: string) {
  const invite = await api()
    .post("/api/v1/admin/businesses")
    .set(bearer(rootToken))
    .send({
      business: { name: "Paging Pakwan", category: "CAFE" },
      owner: { name: "Owner", email: "owner@example.com" },
    });
  const businessId = invite.body.data.business._id as string;
  const token = (invite.body.data.inviteUrl as string).split("/invite/")[1];
  const accepted = await api()
    .post(`/api/v1/invitations/${token}/accept`)
    .send({ password: PASSWORD });
  const ownerToken = accepted.body.data.accessToken as string;
  await enableMfa(ownerToken);
  return { businessId, ownerToken };
}

/** Follows nextCursor to the end, returning every row in order. */
async function walk(url: string, token: string) {
  const rows: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await api()
      .get(`${url}${sep}limit=3${cursor ? `&cursor=${cursor}` : ""}`)
      .set(bearer(token));
    expect(res.status).toBe(200);
    rows.push(...res.body.data);
    cursor = res.body.meta.nextCursor;
    if (!cursor) return rows;
  }
  throw new Error("did not finish");
}

describe("cursor pagination", () => {
  it("returns every customer exactly once, including those not stamped yet and ties", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const { businessId, ownerToken } = await onboard(root.token);
    const same = new Date("2026-10-01T10:00:00Z");
    const stampedAt = [same, same, same, new Date("2026-10-02T10:00:00Z"), null, null, null, null];

    for (const [i, lastStampAt] of stampedAt.entries()) {
      const user = await User.create({ name: `Customer ${i}`, email: `c${i}@example.com` });
      await LoyaltyCard.create({
        customerId: user._id,
        businessId,
        programId: new Types.ObjectId(),
        lastStampAt,
      });
    }

    const rows = await walk(`/api/v1/businesses/${businessId}/customers`, ownerToken);
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((r) => r.cardId)).size).toBe(8);
    // Most recent first; never-stamped last.
    expect(rows[0]!.lastStampAt).toBe("2026-10-02T10:00:00.000Z");
    expect(rows.slice(4).every((r) => r.lastStampAt == null)).toBe(true);
  });

  it("pages the audit log without gaps or repeats", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    await AuditLog.deleteMany({});
    const at = new Date();
    await AuditLog.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        action: `test.${i}`,
        resourceType: "Test",
        createdAt: at,
      })),
    );
    const rows = await walk("/api/v1/admin/audit-logs", root.token);
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((r) => r._id)).size).toBe(10);
  });

  it("rejects a tampered cursor with a clear error", async () => {
    const root = await platformUser("root@example.com", "SUPER_ADMIN");
    const res = await api()
      .get("/api/v1/admin/audit-logs?cursor=not-a-cursor")
      .set(bearer(root.token));
    expect(res.status).toBe(400);
    const injected = Buffer.from(JSON.stringify([{ $gt: "" }, "x"])).toString("base64url");
    const again = await api()
      .get(`/api/v1/admin/audit-logs?cursor=${injected}`)
      .set(bearer(root.token));
    expect(again.status).toBe(400);
  });
});
