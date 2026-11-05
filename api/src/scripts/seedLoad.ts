import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { disconnectRedis } from "@/config/redis";
import { env } from "@/config/env";
import {
  Branch,
  Business,
  BusinessMember,
  LoyaltyCard,
  LoyaltyProgram,
  NfcDevice,
  Stamp,
  User,
} from "@/models";
import { signAccessToken } from "@/modules/auth/token.service";
import { BUSINESS_STATUS, DEVICE_STATUS, TAG_TYPE } from "@taptapsell/constants";

// Data for the load tests in loadtests/. Refuses any database whose name does
// not contain "load", so it can never touch real data. Writes access tokens
// for the k6 scripts to loadtests/.data/ (ignored by git).
// Usage: MONGODB_URI=.../taptapsell_load npm run seed:load --workspace=api
const BUSINESSES = Number(process.env.LOAD_BUSINESSES ?? 20);
const STAMPERS_PER_BUSINESS = Number(process.env.LOAD_STAMPERS ?? 10);
const CUSTOMERS_PER_BUSINESS = Number(process.env.LOAD_CUSTOMERS ?? 250);
const STAMPS_PER_CUSTOMER = Number(process.env.LOAD_HISTORY ?? 40);
const BATCH = 5000;

async function insertInBatches(
  collection: { insertMany(docs: never[]): Promise<unknown> },
  docs: unknown[],
) {
  for (let i = 0; i < docs.length; i += BATCH) {
    await collection.insertMany(docs.slice(i, i + BATCH) as never[]);
  }
}

async function main(): Promise<void> {
  if (!/load/i.test(new URL(env.MONGODB_URI).pathname)) {
    throw new Error('Refusing to seed: the database name must contain "load".');
  }
  await connectDatabase();

  const stampers: Array<{ deviceIdentifier: string; tagUid: string; business: number }> = [];
  const customers: string[][] = [];
  const owners: Array<{ businessId: string; token: string }> = [];
  const users: unknown[] = [];
  const cards: unknown[] = [];
  const stamps: unknown[] = [];
  const devices: unknown[] = [];
  const longAgo = Date.now() - 180 * 86_400_000;

  for (let b = 0; b < BUSINESSES; b += 1) {
    const businessId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    // Owners must use two-step verification; marked on so dashboard reads are allowed.
    users.push({
      _id: ownerId,
      name: `Owner ${b}`,
      email: `owner${b}@load.local`,
      status: "ACTIVE",
      mfa: { enabled: true },
    });
    owners.push({
      businessId: businessId.toString(),
      token: signAccessToken(ownerId.toString(), new Types.ObjectId().toString()),
    });

    await Business.create({
      _id: businessId,
      name: `Load Business ${b}`,
      slug: `load-business-${b}`,
      category: "CAFE",
      ownerId,
      status: BUSINESS_STATUS.ACTIVE,
    });
    await BusinessMember.create({ businessId, userId: ownerId, role: "OWNER", status: "ACTIVE" });
    const branch = await Branch.create({ businessId, name: "Main" });
    const program = await LoyaltyProgram.create({
      businessId,
      name: "Load Card",
      requiredStamps: 1000,
      status: "ACTIVE",
      settings: { minMinutesBetweenStamps: 0, maxStampsPerDay: 100_000 },
    });

    for (let s = 0; s < STAMPERS_PER_BUSINESS; s += 1) {
      const deviceIdentifier = `LOAD${b}X${s}`;
      const tagUid = `04${String(b).padStart(4, "0")}${String(s).padStart(4, "0")}AAAA`;
      devices.push({
        deviceIdentifier,
        businessId,
        branchId: branch._id,
        status: DEVICE_STATUS.ACTIVE,
        tagType: TAG_TYPE.NTAG21X_MIRROR,
        tagUid,
      });
      stampers.push({ deviceIdentifier, tagUid, business: b });
    }

    const tokens: string[] = [];
    for (let c = 0; c < CUSTOMERS_PER_BUSINESS; c += 1) {
      const customerId = new Types.ObjectId();
      const cardId = new Types.ObjectId();
      users.push({ _id: customerId, name: `Customer ${c}`, email: `c${b}-${c}@load.local` });
      cards.push({
        _id: cardId,
        customerId,
        businessId,
        programId: program._id,
        stampCount: STAMPS_PER_CUSTOMER,
        status: "ACTIVE",
      });
      for (let h = 0; h < STAMPS_PER_CUSTOMER; h += 1) {
        const at = new Date(longAgo + h * 86_400_000);
        stamps.push({
          businessId,
          branchId: branch._id,
          programId: program._id,
          loyaltyCardId: cardId,
          customerId,
          source: "NFC",
          idempotencyKey: `seed-${cardId}-${h}`,
          createdAt: at,
          updatedAt: at,
        });
      }
      tokens.push(signAccessToken(customerId.toString(), new Types.ObjectId().toString()));
    }
    customers.push(tokens);
  }

  await insertInBatches(User.collection, users);
  await insertInBatches(LoyaltyCard.collection, cards);
  await insertInBatches(NfcDevice.collection, devices);
  await insertInBatches(Stamp.collection, stamps);

  const out = path.resolve(__dirname, "../../../loadtests/.data");
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "seed.json"), JSON.stringify({ stampers, customers, owners }));
  console.log(
    `Seeded ${BUSINESSES} businesses, ${stampers.length} stampers, ${users.length} users, ${stamps.length} stamps.`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([disconnectDatabase(), disconnectRedis()]));
