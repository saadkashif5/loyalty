import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { Business, NfcDevice, OutboxMessage, User } from "@/models";
import { invalidate, useCacheStore, cached, type CacheStore } from "@/services/cache.service";
import { resolveDeviceForStamping } from "@/modules/devices/devices.service";
import * as email from "@/services/email.service";
import { processOutbox } from "@/services/outbox.service";
import { bearer, api, registerUser } from "./helpers";

function memoryStore() {
  const data = new Map<string, string>();
  const store: CacheStore = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => data.set(key, value),
    del: async (keys) => keys.forEach((key) => data.delete(key)),
  };
  return { data, store };
}

describe("cache", () => {
  let data: Map<string, string>;

  beforeEach(() => {
    const memory = memoryStore();
    data = memory.data;
    useCacheStore(memory.store);
  });
  afterEach(() => useCacheStore(null));

  async function activeStamper() {
    const owner = new Types.ObjectId();
    const business = await Business.create({
      name: "Cached Cafe",
      slug: `cached-${owner}`,
      category: "CAFE",
      ownerId: owner,
      status: "ACTIVE",
    });
    const device = await NfcDevice.create({
      deviceIdentifier: `C${owner.toString().slice(-8)}`,
      businessId: business._id,
      branchId: new Types.ObjectId(),
      status: "ACTIVE",
      tagType: "NTAG21X_MIRROR",
    });
    await resolveDeviceForStamping(device.deviceIdentifier);
    return { business, device };
  }

  it("loads once, and does not cache a miss", async () => {
    const load = vi.fn(async () => ({ a: 1 }));
    await cached("k", 60, load);
    expect(await cached("k", 60, load)).toEqual({ a: 1 });
    expect(load).toHaveBeenCalledTimes(1);

    const empty = vi.fn(async () => null);
    await cached("none", 60, empty);
    await cached("none", 60, empty);
    expect(empty).toHaveBeenCalledTimes(2);

    await invalidate(["k"]);
    expect(data.has("k")).toBe(false);
  });

  it("serves the stamper from cache", async () => {
    const { device } = await activeStamper();
    const find = vi.spyOn(NfcDevice, "findOne");
    await resolveDeviceForStamping(device.deviceIdentifier);
    expect(find).not.toHaveBeenCalled();
    find.mockRestore();
  });

  it("stops a revoked stamper at once, however it was revoked", async () => {
    const { device } = await activeStamper();
    await NfcDevice.updateOne({ _id: device._id }, { $set: { status: "REVOKED" } });
    await expect(resolveDeviceForStamping(device.deviceIdentifier)).rejects.toThrow(/inactive/);
  });

  it("stops a stamper revoked by saving the document", async () => {
    const { device } = await activeStamper();
    const doc = await NfcDevice.findById(device._id);
    doc!.status = "REVOKED";
    await doc!.save();
    await expect(resolveDeviceForStamping(device.deviceIdentifier)).rejects.toThrow(/inactive/);
  });

  it("stops stamps at once when the business is suspended", async () => {
    const { business, device } = await activeStamper();
    await Business.findOneAndUpdate({ _id: business._id }, { status: "SUSPENDED" });
    await expect(resolveDeviceForStamping(device.deviceIdentifier)).rejects.toThrow(/accepting/);
  });

  it("keeps the cache through writes to unwatched fields", async () => {
    const { device } = await activeStamper();
    await NfcDevice.updateOne({ _id: device._id }, { $set: { lastTapCounter: 9 } });
    expect(data.has(`device:${device.deviceIdentifier}`)).toBe(true);
  });

  it("signs out a suspended user at once", async () => {
    const user = await registerUser("cached@example.com", "Cached");
    const me = () => api().get("/api/v1/users/me").set(bearer(user.token));
    expect((await me()).status).toBe(200);
    await User.updateOne({ _id: user.userId }, { status: "SUSPENDED" });
    expect((await me()).status).toBe(401);
  });

  it("falls back to the database when the cache is down", async () => {
    const { device } = await activeStamper();
    useCacheStore({
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => undefined,
      del: async () => undefined,
    });
    const found = await resolveDeviceForStamping(device.deviceIdentifier);
    expect(found.deviceId).toBe(String(device._id));
  });
});

describe("outbox", () => {
  const message = { to: "o@example.com", subject: "Hi", text: "Hello" };

  it("sends a queued message once", async () => {
    const send = vi.spyOn(email, "sendEmail").mockResolvedValue();
    await OutboxMessage.create({ kind: "EMAIL", payload: message });

    expect(await processOutbox()).toBe(1);
    expect(await processOutbox()).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await OutboxMessage.findOne())!.status).toBe("SENT");
    send.mockRestore();
  });

  it("retries with a delay, then gives up and keeps the message", async () => {
    const send = vi.spyOn(email, "sendEmail").mockRejectedValue(new Error("to o@example.com"));
    await OutboxMessage.create({ kind: "EMAIL", payload: message });

    await processOutbox();
    const failed = await OutboxMessage.findOne();
    expect(failed!.status).toBe("PENDING");
    expect(failed!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(failed!.lastError).not.toContain("o@example.com");
    expect(await processOutbox()).toBe(0); // not due yet

    for (let day = 1; day <= 5; day += 1)
      await processOutbox(new Date(Date.now() + day * 86_400_000));
    expect((await OutboxMessage.findOne())!.status).toBe("DEAD");
    expect(send).toHaveBeenCalledTimes(6); // the first attempt, then five more
    send.mockRestore();
  });

  it("recovers a message left behind by a crashed worker", async () => {
    const send = vi.spyOn(email, "sendEmail").mockResolvedValue();
    await OutboxMessage.create({
      kind: "EMAIL",
      payload: message,
      status: "SENDING",
      claimedAt: new Date(Date.now() - 10 * 60_000),
    });
    expect(await processOutbox()).toBe(1);
    send.mockRestore();
  });
});
