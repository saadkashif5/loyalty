import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { inviteMemberSchema, updateMemberSchema } from "@taptapsell/validation";
import * as service from "./members.service";

export const listMembersHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listMembers(req.businessId!));
});

export const inviteMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = inviteMemberSchema.parse(req.body);
  const member = await service.inviteMember(req.businessId!, req.userId!, input);
  sendSuccess(res, member, { status: 201 });
});

export const updateMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateMemberSchema.parse(req.body);
  const member = await service.updateMember(
    req.businessId!,
    req.params.memberId,
    req.userId!,
    input,
  );
  sendSuccess(res, member);
});

export const acceptInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const member = await service.acceptInvite(req.params.businessId, req.userId!);
  sendSuccess(res, member);
});
