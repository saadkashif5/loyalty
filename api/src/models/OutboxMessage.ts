import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const OUTBOX_STATUS = {
  PENDING: "PENDING",
  SENDING: "SENDING",
  SENT: "SENT",
  DEAD: "DEAD",
} as const;

// Work to do after the request has finished, kept in the database so a crash
// or a mail outage loses nothing. Sent messages expire; dead ones stay for review.
const outboxMessageSchema = new Schema(
  {
    kind: { type: String, enum: ["EMAIL"], required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(OUTBOX_STATUS), default: OUTBOX_STATUS.PENDING },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    claimedAt: { type: Date, default: null },
    lastError: { type: String, maxlength: 500 },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

outboxMessageSchema.index({ status: 1, nextAttemptAt: 1 });
outboxMessageSchema.index({ status: 1, claimedAt: 1 });
outboxMessageSchema.index({ sentAt: 1 }, { expireAfterSeconds: 7 * 86_400 });

export type OutboxMessageDocument = HydratedDocument<InferSchemaType<typeof outboxMessageSchema>>;
export const OutboxMessage = model("OutboxMessage", outboxMessageSchema, "outbox_messages");
