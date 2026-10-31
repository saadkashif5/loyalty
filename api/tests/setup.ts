import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Set before any app module is imported — config/env.ts validates on import.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough-1234";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough-1234";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_MAX = "10000";
process.env.INTERNAL_API_SECRET = "test-internal-secret-that-is-long-enough";

// Tests need a replica set, because the stamp flow uses multi-document
// transactions. `docker compose up -d` from the repo root provides one.
// Test files run in parallel and every test wipes the database afterwards, so
// each worker gets its own database.
const BASE_URI = process.env.MONGODB_TEST_URI ?? "mongodb://localhost:27017/taptapsell_test";
const workerUrl = new URL(BASE_URI);
workerUrl.pathname = `${workerUrl.pathname.replace(/\/$/, "") || "/taptapsell_test"}_${process.env.VITEST_POOL_ID ?? "0"}`;
const TEST_URI = workerUrl.toString();
process.env.MONGODB_URI = TEST_URI;

beforeAll(async () => {
  await mongoose.connect(TEST_URI);
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
