import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { User } from "@/models";
import { registerSchema } from "@taptapsell/validation";
import { PLATFORM_ROLES, USER_STATUS } from "@taptapsell/constants";

// Creates the first platform admin, or promotes an existing account to it.
// Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin --workspace=api
// Safe to re-run: an existing account keeps its password and is only promoted.
async function main(): Promise<void> {
  const parsed = registerSchema.safeParse({
    name: process.env.SEED_ADMIN_NAME ?? "Platform Admin",
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    throw new Error(
      `Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ chars): ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`,
    );
  }

  const { name, email, password } = parsed.data;
  await connectDatabase();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.platformRole = PLATFORM_ROLES.SUPER_ADMIN;
    existing.status = USER_STATUS.ACTIVE;
    await existing.save();
    console.log(`Promoted existing account ${email} to SUPER_ADMIN (password unchanged).`);
  } else {
    await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      platformRole: PLATFORM_ROLES.SUPER_ADMIN,
    });
    console.log(`Created SUPER_ADMIN ${email}.`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
