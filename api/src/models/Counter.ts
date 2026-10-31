import { Schema, model } from "mongoose";

// Atomic sequences, e.g. invoice numbers per fiscal year ("invoice:2026-27").
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model("Counter", counterSchema, "counters");
