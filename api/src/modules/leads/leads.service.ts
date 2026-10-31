import { Lead } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { CreateLeadInput, UpdateLeadInput } from "@taptapsell/validation";

export async function createLead(input: CreateLeadInput) {
  const lead = await Lead.create(input);
  // The public form gets nothing back beyond confirmation.
  return { received: true, id: lead._id.toString() };
}

export async function listLeads(options: { status?: string; page: number; limit: number }) {
  const filter = options.status ? { status: options.status } : {};

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("notes.by", "name"),
    Lead.countDocuments(filter),
  ]);

  return { items, total };
}

export async function updateLead(actorUserId: string, leadId: string, input: UpdateLeadInput) {
  const update: Record<string, unknown> = {};
  if (input.status) update.$set = { status: input.status };
  if (input.note) update.$push = { notes: { text: input.note, by: actorUserId } };
  if (Object.keys(update).length === 0) throw ApiError.badRequest("Nothing to update");

  const lead = await Lead.findByIdAndUpdate(leadId, update, { new: true });
  if (!lead) throw ApiError.notFound("Lead not found");

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.LEAD_UPDATED,
    resourceType: "Lead",
    resourceId: leadId,
    metadata: { status: input.status, noted: Boolean(input.note) },
  });

  return lead;
}
