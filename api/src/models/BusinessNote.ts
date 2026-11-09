import { Schema, model } from "mongoose";

// What the platform team learned about a business (calls, issues, promises),
// so whoever helps next has the story. Notes are never edited, only added.
const businessNoteSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

businessNoteSchema.index({ businessId: 1, createdAt: -1 });

export const BusinessNote = model("BusinessNote", businessNoteSchema, "business_notes");
