import { AsyncLocalStorage } from "node:async_hooks";
import mongoose, { Types, type Aggregate, type Query, type Schema } from "mongoose";
import { ApiError } from "@/utils/ApiError";

const tenant = new AsyncLocalStorage<{ businessId: string } | null>();

/**
 * Runs `fn` as one business. Set by requireBusinessRole once access is proven,
 * so everything a business route does is held to that business even if a
 * service forgets its filter: reads and writes on any collection with a
 * `businessId` are limited to it, and naming another business is an error.
 * Jobs, the admin console and customer routes run outside this.
 */
export function runAsTenant<T>(businessId: string, fn: () => T): T {
  return tenant.run({ businessId }, fn);
}

/** For the rare step in a business route that must see past its own business. */
export function runAcrossTenants<T>(fn: () => T): T {
  return tenant.run(null, fn);
}

function crossTenant(): ApiError {
  return ApiError.forbidden("You do not have access to this business");
}

function scopeFilter(this: Query<unknown, unknown>) {
  const businessId = tenant.getStore()?.businessId;
  if (!businessId) return;

  const named = this.getFilter().businessId;
  if (named === undefined) {
    this.where({ businessId });
    return;
  }
  if (String(named) !== businessId) throw crossTenant();
}

function scopePipeline(this: Aggregate<unknown>) {
  const businessId = tenant.getStore()?.businessId;
  if (businessId) {
    this.pipeline().unshift({ $match: { businessId: new Types.ObjectId(businessId) } });
  }
}

function scopeDocument(this: { businessId?: unknown }) {
  const businessId = tenant.getStore()?.businessId;
  if (businessId && String(this.businessId) !== businessId) throw crossTenant();
}

function tenantGuard(schema: Schema) {
  if (!schema.path("businessId")) return;

  for (const op of [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "findOneAndReplace",
    "updateOne",
    "updateMany",
    "replaceOne",
    "deleteOne",
    "deleteMany",
    "countDocuments",
    "distinct",
  ] as const) {
    schema.pre(op, scopeFilter as never);
  }
  schema.pre("aggregate", scopePipeline as never);
  schema.pre("save", scopeDocument as never);
}

// Must load before any model: global plugins apply when a model is compiled.
mongoose.plugin(tenantGuard);
