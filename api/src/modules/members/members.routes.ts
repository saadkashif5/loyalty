import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import {
  listMembersHandler,
  inviteMemberHandler,
  updateMemberHandler,
  acceptInviteHandler,
  declineInviteHandler,
} from "./members.controller";

// Mounted at /api/v1/businesses/:businessId/members
const router = Router({ mergeParams: true });

router.use(requireAuth);

// Accepting an invite happens before membership is ACTIVE, so it cannot sit
// behind requireBusinessRole.
router.post("/accept", acceptInviteHandler);
router.post("/decline", declineInviteHandler);

router.get(
  "/",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.MEMBER_VIEW }),
  listMembersHandler,
);
router.post(
  "/",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.MEMBER_MANAGE }),
  inviteMemberHandler,
);
router.patch(
  "/:memberId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.MEMBER_MANAGE }),
  updateMemberHandler,
);

export default router;
