import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { USER_STATUS, PLATFORM_ROLES } from "@taptapsell/constants";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    // Absent for customers, who sign in with a code sent to their email.
    passwordHash: { type: String, select: false },
    // Set when the person proves they receive mail at this address (email code sign-in).
    emailVerifiedAt: { type: Date },
    avatar: { type: String },
    // Platform-level role (SUPER_ADMIN/ADMIN), distinct from business_members
    // roles. Absent for ordinary customers/business users.
    platformRole: {
      type: String,
      enum: Object.values(PLATFORM_ROLES),
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    // Two-step verification (TOTP). Mandatory for platform users and business
    // owners. Secrets are sealed with utils/secretBox and never selected by default.
    mfa: {
      enabled: { type: Boolean, default: false },
      enabledAt: { type: Date },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
      // Last accepted time step; a code is never accepted twice.
      lastUsedStep: { type: Number, select: false },
      // SHA-256 of each unused recovery code.
      recoveryCodeHashes: { type: [String], select: false, default: undefined },
    },
    notificationPreferences: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model("User", userSchema, "users");
