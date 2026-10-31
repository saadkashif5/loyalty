import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Business,
  BusinessInvitation,
  type BusinessInvitationDocument,
  BusinessMember,
  INVITATION_STATUS,
  Lead,
  User,
} from "@/models";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { generateUniqueSlug } from "@/modules/businesses/businesses.service";
import { hashPassword, issueTokenPair, type AuthContext } from "@/modules/auth/auth.service";
import { toPublicUser } from "@/modules/auth/auth.serializer";
import { createTrialSubscription, startTrial } from "@/modules/billing/subscriptions.service";
import { findActivePlan } from "@/modules/billing/plans.service";
import { BUSINESS_ROLES, BUSINESS_STATUS, MEMBER_STATUS } from "@taptapsell/constants";
import type { AcceptInvitationInput, CreateBusinessWithOwnerInput } from "@taptapsell/validation";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;

type InvitationDoc = BusinessInvitationDocument;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function newToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) };
}

// The link is returned to the platform team so it can also be shared by hand
// (e.g. on WhatsApp) until email and WhatsApp delivery are connected.
function inviteUrl(raw: string): string {
  return `${env.DASHBOARD_URL.replace(/\/$/, "")}/invite/${raw}`;
}

function invalidInvitation() {
  return new ApiError(
    404,
    "INVITATION_INVALID",
    "This invitation link is invalid, has expired or has already been used.",
  );
}

export function toInvitationView(invitation: InvitationDoc) {
  const expired =
    invitation.status === INVITATION_STATUS.PENDING && invitation.expiresAt < new Date();

  return {
    id: invitation._id.toString(),
    businessId: invitation.businessId.toString(),
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone ?? null,
    status: expired ? "EXPIRED" : invitation.status,
    expiresAt: invitation.expiresAt,
    sendCount: invitation.sendCount,
    lastSentAt: invitation.lastSentAt,
    acceptedAt: invitation.acceptedAt ?? null,
    createdAt: invitation.createdAt,
  };
}

/** Creates a business in PENDING and invites its owner. Nobody can manage it until they accept. */
export async function createBusinessWithInvitation(
  actorUserId: string,
  input: CreateBusinessWithOwnerInput,
) {
  if (input.leadId) {
    const lead = await Lead.findById(input.leadId).select("status");
    if (!lead) throw ApiError.notFound("Lead not found");
    if (lead.status === "CONVERTED") throw ApiError.conflict("This lead is already converted");
  }

  // Fails early, before anything is written, if the plan does not exist.
  await findActivePlan(input.planCode);
  const slug = await generateUniqueSlug(input.business.name);
  const token = newToken();
  const session = await mongoose.startSession();

  let business!: InstanceType<typeof Business>;
  let invitation!: InvitationDoc;

  try {
    await session.withTransaction(async () => {
      [business] = await Business.create(
        [{ ...input.business, slug, status: BUSINESS_STATUS.PENDING }],
        { session },
      );
      [invitation] = await BusinessInvitation.create(
        [
          {
            businessId: business._id,
            name: input.owner.name,
            email: input.owner.email,
            phone: input.owner.phone,
            tokenHash: token.tokenHash,
            expiresAt: token.expiresAt,
            invitedBy: actorUserId,
          },
        ],
        { session },
      );
      await createTrialSubscription(business._id, input.planCode, input.trialDays, session);
      if (input.leadId) {
        await Lead.updateOne(
          { _id: input.leadId },
          { $set: { status: "CONVERTED", businessId: business._id } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await recordAudit({
    actorUserId,
    businessId: business._id,
    action: AUDIT_ACTIONS.INVITATION_CREATED,
    resourceType: "BusinessInvitation",
    resourceId: invitation._id,
    metadata: { email: input.owner.email, leadId: input.leadId },
  });

  return { business, invitation: toInvitationView(invitation), inviteUrl: inviteUrl(token.raw) };
}

export async function listInvitations(businessId: string) {
  const invitations = await BusinessInvitation.find({ businessId }).sort({ createdAt: -1 });
  return invitations.map(toInvitationView);
}

/** Issues a new link and a fresh expiry; the previous link stops working. */
export async function resendInvitation(actorUserId: string, invitationId: string) {
  const existing = await BusinessInvitation.findById(invitationId).select("status");
  if (!existing) throw ApiError.notFound("Invitation not found");

  const token = newToken();
  const invitation = await BusinessInvitation.findOneAndUpdate(
    { _id: invitationId, status: INVITATION_STATUS.PENDING },
    {
      $set: { tokenHash: token.tokenHash, expiresAt: token.expiresAt, lastSentAt: new Date() },
      $inc: { sendCount: 1 },
    },
    { new: true },
  );
  if (!invitation) throw ApiError.conflict("Only a pending invitation can be resent");

  await recordAudit({
    actorUserId,
    businessId: invitation.businessId,
    action: AUDIT_ACTIONS.INVITATION_RESENT,
    resourceType: "BusinessInvitation",
    resourceId: invitation._id,
  });

  return { invitation: toInvitationView(invitation), inviteUrl: inviteUrl(token.raw) };
}

export async function revokeInvitation(actorUserId: string, invitationId: string) {
  const invitation = await BusinessInvitation.findOneAndUpdate(
    { _id: invitationId, status: INVITATION_STATUS.PENDING },
    { $set: { status: INVITATION_STATUS.REVOKED, revokedAt: new Date() } },
    { new: true },
  );
  if (!invitation) throw ApiError.conflict("Only a pending invitation can be revoked");

  await recordAudit({
    actorUserId,
    businessId: invitation.businessId,
    action: AUDIT_ACTIONS.INVITATION_REVOKED,
    resourceType: "BusinessInvitation",
    resourceId: invitation._id,
  });

  return toInvitationView(invitation);
}

async function findUsableInvitation(rawToken: string) {
  const invitation = await BusinessInvitation.findOne({
    tokenHash: hashToken(rawToken),
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });
  if (!invitation) throw invalidInvitation();
  return invitation;
}

/** What the invitee sees before accepting. Only the link holder can call this. */
export async function getInvitationForInvitee(rawToken: string) {
  const invitation = await findUsableInvitation(rawToken);
  const business = await Business.findById(invitation.businessId).select("name logo category");
  if (!business) throw invalidInvitation();

  return {
    business: { name: business.name, logo: business.logo ?? null, category: business.category },
    name: invitation.name,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    accountExists: Boolean(await User.exists({ email: invitation.email })),
  };
}

/**
 * Accepts an owner invitation. A new invitee sets a password and is signed in;
 * an invitee who already has an account (e.g. as a customer) must be signed
 * in as that account, so nobody can claim someone else's account with a link.
 */
export async function acceptInvitation(
  rawToken: string,
  input: AcceptInvitationInput,
  actorUserId: string | undefined,
  ctx: AuthContext,
) {
  const invitation = await findUsableInvitation(rawToken);
  const existing = await User.findOne({ email: invitation.email });

  if (existing) {
    if (actorUserId !== existing.id) {
      throw new ApiError(
        409,
        "ACCOUNT_EXISTS",
        "An account with this email already exists. Sign in with it, then open the invitation link again.",
      );
    }
  } else {
    if (actorUserId) {
      throw ApiError.forbidden(
        "This invitation was sent to a different email address. Sign out and open the link again.",
      );
    }
    if (!input.password) throw ApiError.badRequest("Choose a password to create your account");
  }

  const passwordHash = existing ? null : await hashPassword(input.password!);
  // The phone is optional; skip it rather than fail if another account already uses it.
  const phoneTaken = invitation.phone ? await User.exists({ phone: invitation.phone }) : true;

  const session = await mongoose.startSession();
  let user!: InstanceType<typeof User>;

  try {
    await session.withTransaction(async () => {
      const claimed = await BusinessInvitation.findOneAndUpdate(
        { _id: invitation._id, status: INVITATION_STATUS.PENDING, expiresAt: { $gt: new Date() } },
        { $set: { status: INVITATION_STATUS.ACCEPTED, acceptedAt: new Date() } },
        { new: true, session },
      );
      if (!claimed) throw invalidInvitation();

      if (existing) {
        user = existing;
      } else {
        [user] = await User.create(
          [
            {
              name: input.name ?? invitation.name,
              email: invitation.email,
              ...(phoneTaken ? {} : { phone: invitation.phone }),
              passwordHash,
            },
          ],
          { session },
        );
      }

      claimed.acceptedBy = user._id;
      await claimed.save({ session });

      await BusinessMember.findOneAndUpdate(
        { userId: user._id, businessId: invitation.businessId },
        {
          $set: { role: BUSINESS_ROLES.OWNER, status: MEMBER_STATUS.ACTIVE },
          $setOnInsert: { invitedBy: invitation.invitedBy },
        },
        { upsert: true, session },
      );

      await startTrial(invitation.businessId, session);

      // A business suspended while the invitation was open stays suspended.
      await Business.updateOne(
        { _id: invitation.businessId, status: BUSINESS_STATUS.PENDING },
        { $set: { status: BUSINESS_STATUS.ACTIVE } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await recordAudit({
    actorUserId: user._id,
    actorRole: BUSINESS_ROLES.OWNER,
    businessId: invitation.businessId,
    action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
    resourceType: "BusinessInvitation",
    resourceId: invitation._id,
  });

  const tokens = existing ? null : await issueTokenPair(user.id, ctx);
  return {
    user: toPublicUser(user),
    businessId: invitation.businessId.toString(),
    mfaSetupRequired: !user.mfa?.enabled,
    ...(tokens ?? {}),
  };
}
