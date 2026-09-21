import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { registerSchema, loginSchema, refreshTokenSchema } from "@taptapsell/validation";
import * as authService from "./auth.service";
import { toPublicUser } from "./auth.serializer";

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await authService.register(input, {
    userAgent: req.header("user-agent"),
    ip: req.ip,
  });
  sendSuccess(res, { user: toPublicUser(user), ...tokens }, { status: 201 });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { user, tokens } = await authService.login(input, {
    userAgent: req.header("user-agent"),
    ip: req.ip,
  });
  sendSuccess(res, { user: toPublicUser(user), ...tokens });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken, {
    userAgent: req.header("user-agent"),
    ip: req.ip,
  });
  sendSuccess(res, tokens);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  await authService.logout(refreshToken);
  sendSuccess(res, { loggedOut: true });
});
