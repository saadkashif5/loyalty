import { Schema, model } from "mongoose";
import { NOTIFICATION_STATUS } from "@taptapsell/constants";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "STAMP_ADDED",
        "REWARD_UNLOCKED",
        "REWARD_EXPIRING",
        "STAMPS_EXPIRING",
        "STAMPS_EXPIRED",
        "REWARD_REDEEMED",
        "LOYALTY_MILESTONE",
        "BUSINESS_ANNOUNCEMENT",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
    },
    sentAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, status: 1 });

export const Notification = model("Notification", notificationSchema, "notifications");
