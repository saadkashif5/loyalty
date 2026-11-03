import { ApiError } from "@/utils/ApiError";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { Notification, User } from "@/models";
import { NOTIFICATION_STATUS } from "@taptapsell/constants";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const items = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit);
    sendSuccess(res, items);
  }),
);

router.post(
  "/:notificationId/read",
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.userId },
      { status: NOTIFICATION_STATUS.READ },
      { new: true },
    );
    if (!notification) throw ApiError.notFound("Notification not found");
    sendSuccess(res, notification);
  }),
);

const preferencesSchema = z.object({
  push: z.boolean().optional(),
  email: z.boolean().optional(),
});

router.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const input = preferencesSchema.parse(req.body);
    const update: Record<string, boolean> = {};
    if (input.push !== undefined) update["notificationPreferences.push"] = input.push;
    if (input.email !== undefined) update["notificationPreferences.email"] = input.email;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    sendSuccess(res, user?.notificationPreferences);
  }),
);

export default router;
