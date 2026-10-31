import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { env } from "@/config/env";
import { Business, NfcDevice, User } from "@/models";
import { createBusiness } from "@/modules/businesses/businesses.service";
import { createBranch } from "@/modules/branches/branches.service";
import { createProgram, updateProgram } from "@/modules/loyalty/programs.service";
import { createReward } from "@/modules/rewards/rewards.service";
import { joinProgram } from "@/modules/loyalty/cards.service";
import { createManualStamp } from "@/modules/stamps/stamps.service";
import { BUSINESS_STATUS, DEVICE_STATUS, TAG_TYPE } from "@taptapsell/constants";

// Demo data for local development: one active café with a branch, a
// two-tier program, an active stamper and three customers part-way through
// their cards. Everything goes through the real services, so the data obeys
// the same rules as production. Safe to re-run: it stops if the demo exists.
// Usage: npm run seed:demo --workspace=api
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo-password-123";
const OWNER_EMAIL = "owner@demo.taptapsell.local";
const DEVICE_IDENTIFIER = "DEMO01";
const CUSTOMERS = [
  { name: "Ayesha Khan", email: "ayesha@demo.taptapsell.local", stamps: 2 },
  { name: "Bilal Ahmed", email: "bilal@demo.taptapsell.local", stamps: 4 },
  { name: "Sana Iqbal", email: "sana@demo.taptapsell.local", stamps: 0 },
];

async function upsertUser(name: string, email: string) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12) });
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
    throw new Error("Demo data must never be seeded into staging or production.");
  }

  await connectDatabase();

  const owner = await upsertUser("Demo Owner", OWNER_EMAIL);
  if (await Business.exists({ slug: "demo-chai-cafe" })) {
    console.log("Demo data already exists; nothing to do.");
    return;
  }

  const ownerId = owner._id.toString();
  const business = await createBusiness(ownerId, {
    name: "Demo Chai Cafe",
    description: "Seeded demo business for local development.",
    category: "CAFE",
    contact: { phone: "+923001234567", address: "MM Alam Road, Gulberg, Lahore" },
  });
  const businessId = business._id.toString();
  // Stands in for Super Admin approval.
  await Business.updateOne(
    { _id: businessId },
    { slug: "demo-chai-cafe", status: BUSINESS_STATUS.ACTIVE },
  );

  const branch = await createBranch(businessId, ownerId, {
    name: "Gulberg",
    address: "MM Alam Road, Gulberg, Lahore",
    location: { lat: 31.5134, lng: 74.3502 },
  });
  const branchId = branch._id.toString();

  // No cooldown or daily cap while seeding; both restored below.
  const program = await createProgram(businessId, ownerId, {
    name: "Chai Card",
    description: "Collect 6 stamps: free samosa at 3, free chai at 6.",
    requiredStamps: 6,
    minMinutesBetweenStamps: 0,
    maxStampsPerDay: 50,
  });
  const programId = program._id.toString();

  await createReward(businessId, ownerId, {
    programId,
    name: "Free Samosa",
    type: "FREE_ITEM",
    requiredStamps: 3,
    redemptionLimit: 1,
  });
  await createReward(businessId, ownerId, {
    programId,
    name: "Free Doodh Patti",
    type: "FREE_ITEM",
    requiredStamps: 6,
    redemptionLimit: 1,
  });

  await NfcDevice.create({
    deviceIdentifier: DEVICE_IDENTIFIER,
    businessId,
    branchId,
    status: DEVICE_STATUS.ACTIVE,
    tagType: TAG_TYPE.NTAG21X_MIRROR,
  });

  for (const [index, person] of CUSTOMERS.entries()) {
    const customer = await upsertUser(person.name, person.email);
    const card = await joinProgram(customer._id.toString(), programId);

    for (let i = 0; i < person.stamps; i += 1) {
      await createManualStamp({
        businessId,
        actorUserId: ownerId,
        loyaltyCardId: card._id.toString(),
        branchId,
        idempotencyKey: `seed-demo-${index}-${i}`,
      });
    }
  }

  await updateProgram(businessId, programId, ownerId, {
    minMinutesBetweenStamps: 5,
    maxStampsPerDay: 3,
  });

  console.log("Demo data created. Password for every demo account:", DEMO_PASSWORD);
  console.log(`  Owner:     ${OWNER_EMAIL}`);
  for (const person of CUSTOMERS)
    console.log(`  Customer:  ${person.email} (${person.stamps} stamps)`);
  console.log(
    `  Stamper:   ${DEVICE_IDENTIFIER} — tap with POST /api/v1/taps, params.m = <UID>x<counter>`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
