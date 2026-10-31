import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { ApiError } from "@/utils/ApiError";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  mfaCodeSchema,
  mfaLoginSchema,
} from "@taptapsell/validation";
import * as authService from "./auth.service";
import * as mfaService from "./mfa.service";
import { listActiveSessions, revokeOtherSessions, revokeSession } from "./token.service";
import { toPublicUser } from "./auth.serializer";

function context(req: Request) {
  return { userAgent: req.header("user-agent"), ip: req.ip };
}

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await authService.register(input, context(req));
  sendSuccess(res, { user: toPublicUser(user), ...tokens }, { status: 201 });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, context(req));

  if (result.mfaRequired) {
    sendSuccess(res, { mfaRequired: true, mfaToken: result.mfaToken });
    return;
  }
  sendSuccess(res, { mfaRequired: false, user: toPublicUser(result.user), ...result.tokens });
});

export const mfaLoginHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = mfaLoginSchema.parse(req.body);
  const { user, tokens } = await authService.completeMfaLogin(input, context(req));
  sendSuccess(res, { user: toPublicUser(user), ...tokens });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken, context(req));
  sendSuccess(res, tokens);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  await authService.logout(refreshToken);
  sendSuccess(res, { loggedOut: true });
});

// ---- Two-step verification ----------------------------------------------

export const mfaSetupHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await mfaService.startMfaSetup(req.userId!));
});

export const mfaEnableHandler = asyncHandler(async (req: Request, res: Response) => {
  const { code } = mfaCodeSchema.parse(req.body);
  const recoveryCodes = await mfaService.enableMfa(req.userId!, code);
  // Shown once; only their hashes are stored.
  sendSuccess(res, { enabled: true, recoveryCodes });
});

export const mfaDisableHandler = asyncHandler(async (req: Request, res: Response) => {
  const { code } = mfaCodeSchema.parse(req.body);
  await mfaService.disableMfa(req.userId!, code);
  sendSuccess(res, { enabled: false });
});

export const mfaStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, {
    enabled: Boolean(req.mfaEnabled),
    required: await mfaService.isMfaMandatory(req.userId!),
  });
});

// ---- Sessions -------------------------------------------------------------

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await listActiveSessions(req.userId!);
  sendSuccess(
    res,
    sessions.map((s) => ({
      id: s._id.toString(),
      userAgent: s.userAgent ?? null,
      ip: s.ip ?? null,
      createdAt: s.createdAt,
      current: s._id.toString() === req.sessionId,
    })),
  );
});

export const revokeSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const revoked = await revokeSession(req.userId!, req.params.sessionId);
  if (!revoked) throw ApiError.notFound("Session not found");
  sendSuccess(res, { revoked: true });
});

export const revokeOtherSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const count = await revokeOtherSessions(req.userId!, req.sessionId!);
  sendSuccess(res, { revoked: count });
});
