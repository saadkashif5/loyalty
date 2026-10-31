import { Schema, model } from "mongoose";

// Platform-wide settings edited by the team, one document per key.
// "billing": who issues invoices, tax, and where owners send money.
const bankAccountSchema = new Schema(
  {
    bankName: { type: String, required: true, maxlength: 80 },
    accountTitle: { type: String, required: true, maxlength: 120 },
    accountNumber: { type: String, required: true, maxlength: 40 },
    iban: { type: String, maxlength: 34 },
  },
  { _id: false },
);

const platformSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    billing: {
      companyName: { type: String, default: "TapTapSell", maxlength: 160 },
      address: { type: String, maxlength: 500 },
      ntn: { type: String, maxlength: 20 },
      strn: { type: String, maxlength: 20 },
      email: { type: String, maxlength: 254 },
      phone: { type: String, maxlength: 30 },
      taxLabel: { type: String, default: "Sales tax", maxlength: 40 },
      taxRatePercent: { type: Number, default: 0, min: 0, max: 50 },
      invoicePrefix: { type: String, default: "TTS", maxlength: 10 },
      bankAccounts: { type: [bankAccountSchema], default: [] },
      raastId: { type: String, maxlength: 40 },
      paymentInstructions: { type: String, maxlength: 1000 },
    },
  },
  { timestamps: true },
);

export const PlatformSetting = model("PlatformSetting", platformSettingSchema, "platform_settings");
