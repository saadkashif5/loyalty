import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { can, requirePermission } from "@/lib/me";
import { apiFetch } from "@/lib/api";
import type { Plan } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { InviteBusinessForm, type InvitePrefill } from "./InviteBusinessForm";

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<InvitePrefill>;
}) {
  const me = await requirePermission(PLATFORM_PERMISSIONS.BUSINESS_MANAGE);
  // Admins without billing access still invite; they just get the default plan list.
  const plans = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_VIEW)
    ? (await apiFetch<Plan[]>("/admin/plans")).filter((p) => p.isActive)
    : [{ code: "STARTER", name: "Starter", isPublic: true, isActive: true }];
  // Pre-filled when coming from a lead ("Invite this business").
  const prefill = await searchParams;

  return (
    <div className="max-w-3xl">
      <Link href="/businesses" className="text-sm text-slate-500 hover:text-slate-900">
        ← Businesses
      </Link>
      <PageHeader
        title="Invite a business"
        description="Creates the business (pending) and an invitation link for its owner. The business becomes active when the owner accepts."
      />
      <InviteBusinessForm prefill={prefill} plans={plans} />
    </div>
  );
}
