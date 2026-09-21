import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Set before any app module is imported — config/env.ts validates on import.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough-1234";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough-1234";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_MAX = "10000";

// Tests need a replica set, because the stamp flow uses multi-document
// transactions. `docker compose up -d` from the repo root provides one.
const TEST_URI = process.env.MONGODB_TEST_URI ?? "mongodb://localhost:27017/taptapsell_test";
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
