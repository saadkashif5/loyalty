import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { ApiError } from "@/utils/ApiError";
import { User } from "@/models";
import { toPublicUser } from "@/modules/auth/auth.serializer";

export const getMeHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.notFound("User not found");
  sendSuccess(res, toPublicUser(user));
});
