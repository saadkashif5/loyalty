import { Schema, model } from "mongoose";
import { DEVICE_STATUS, TAG_TYPE } from "@taptapsell/constants";

const nfcDeviceSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business" }, // null while UNASSIGNED
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    deviceIdentifier: { type: String, required: true, unique: true }, // public identifier embedded in tag/QR
    deviceType: {
      type: String,
      enum: ["NFC_TAG", "NFC_PUCK", "STICKER", "OTHER"],
      default: "NFC_TAG",
    },
    status: {
      type: String,
      enum: Object.values(DEVICE_STATUS),
      default: DEVICE_STATUS.UNASSIGNED,
    },
    tagType: { type: String, enum: Object.values(TAG_TYPE), default: TAG_TYPE.NTAG21X_MIRROR },
    // Chip UID reported by the tag; bound on the first verified tap so a tag
    // programmed with another stamper's URL is rejected afterwards.
    tagUid: { type: String, default: null },
    // Highest tap counter accepted. A tap must exceed it, so a saved or shared
    // stamper URL cannot be used again.
    lastTapCounter: { type: Number, default: null },
    lastTapAt: { type: Date, default: null },
    activationCode: { type: String, select: false }, // one-time code used to activate; never the security credential itself
    replacedByDeviceId: { type: Schema.Types.ObjectId, ref: "NfcDevice", default: null },
    revokedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

nfcDeviceSchema.index({ businessId: 1, branchId: 1 });

export const NfcDevice = model("NfcDevice", nfcDeviceSchema, "nfc_devices");
