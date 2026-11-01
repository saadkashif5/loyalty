import type { Query, Schema } from "mongoose";
import { logger } from "@/config/logger";
import { redis } from "@/config/redis";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  del(keys: string[]): Promise<unknown>;
}

const client = redis;
const redisStore: CacheStore | null = client && {
  get: (key) => client.get(key),
  set: (key, value, ttlSeconds) => client.set(key, value, "EX", ttlSeconds),
  del: (keys) => client.del(...keys),
};

// Without Redis (development, tests) nothing is cached: a cache in one process
// could not be invalidated from another.
let store: CacheStore | null = redisStore;

/** Tests swap in their own store. */
export function useCacheStore(next: CacheStore | null) {
  store = next;
}

/**
 * Reads through the cache. A cache failure must never fail the request, so
 * every error falls back to the loader. null is not cached.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  if (!store) return load();

  try {
    const hit = await store.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, key }, "Cache read failed");
    return load();
  }

  const value = await load();
  if (value !== null && value !== undefined) {
    await store
      .set(key, JSON.stringify(value), ttlSeconds)
      .catch((err) => logger.warn({ err, key }, "Cache write failed"));
  }
  return value;
}

export async function invalidate(keys: string[]): Promise<void> {
  if (!store || keys.length === 0) return;
  await store.del(keys).catch((err) => logger.error({ err, keys }, "Cache invalidation failed"));
}

const QUERY_WRITES = ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"];

function touches(update: Record<string, unknown>, fields: string[]) {
  const changed = Object.entries(update).flatMap(([key, value]) =>
    key.startsWith("$") ? Object.keys(value as object) : [key],
  );
  return changed.some((path) => fields.includes(path.split(".")[0]!));
}

/**
 * Drops cached copies whenever a document's watched fields change, however the
 * write was made, so a revoked stamper or suspended account cannot outlive its
 * cache entry through a forgotten code path. Registered on the schema because
 * authorization depends on it. A write inside a transaction clears the entry
 * just before commit; the short TTLs bound that gap.
 */
export function invalidatesCache(
  schema: Schema,
  options: { fields: string[]; keys: (doc: Record<string, unknown>) => string[] },
) {
  const pending = new WeakMap<object, string[]>();

  for (const op of QUERY_WRITES) {
    schema.pre(op as never, async function (this: Query<unknown, unknown>) {
      if (!store) return;
      const update = (this.getUpdate() ?? {}) as Record<string, unknown>;
      if (!op.startsWith("delete") && !touches(update, options.fields)) return;

      const docs = await this.model
        .find(this.getFilter())
        .lean()
        .session(this.getOptions().session ?? null);
      pending.set(
        this,
        docs.flatMap((doc) => options.keys(doc as Record<string, unknown>)),
      );
    });
    schema.post(op as never, async function (this: object) {
      await invalidate(pending.get(this) ?? []);
    });
  }

  schema.pre("save", function () {
    if (options.fields.some((field) => this.isModified(field))) {
      pending.set(this, options.keys(this.toObject()));
    }
  });
  schema.post("save", async function () {
    await invalidate(pending.get(this) ?? []);
  });
}
