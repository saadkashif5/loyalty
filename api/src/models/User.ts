import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { USER_STATUS, PLATFORM_ROLES } from "@taptapsell/constants";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
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
    notificationPreferences: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model("User", userSchema, "users");
