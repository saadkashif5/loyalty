import { Router } from "express";
import publicPlansRoutes from "@/modules/billing/publicPlans.routes";
import authRoutes from "@/modules/auth/auth.routes";
import usersRoutes from "@/modules/users/users.routes";
import businessesRoutes from "@/modules/businesses/businesses.routes";
import discoveryRoutes from "@/modules/businesses/discovery.routes";
import businessScopedRoutes from "./business.routes";
import cardsRoutes from "@/modules/loyalty/cards.routes";
import stampsRoutes from "@/modules/stamps/stamps.routes";
import tapsRoutes from "@/modules/taps/taps.routes";
import redemptionsRoutes from "@/modules/redemptions/redemptions.routes";
import notificationsRoutes from "@/modules/notifications/notifications.routes";
import adminRoutes from "@/modules/admin/admin.routes";
import invitationsRoutes from "@/modules/invitations/invitations.routes";
import leadsRoutes from "@/modules/leads/leads.routes";

const router = Router();

// Identity
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);

// Public discovery + QR stamper landing (unauthenticated)
router.use("/discover", discoveryRoutes);

// Owner invitations (link holder) and the "request access" form
router.use("/invitations", invitationsRoutes);
router.use("/leads", leadsRoutes);
router.use("/plans", publicPlansRoutes);

// Business dashboard surface
router.use("/businesses", businessesRoutes);
router.use("/businesses/:businessId", businessScopedRoutes);

// Customer app surface
router.use("/loyalty-cards", cardsRoutes);
router.use("/taps", tapsRoutes);
router.use("/stamps", stampsRoutes);
router.use("/redemptions", redemptionsRoutes);
router.use("/notifications", notificationsRoutes);

// Platform administration
router.use("/admin", adminRoutes);

export default router;
