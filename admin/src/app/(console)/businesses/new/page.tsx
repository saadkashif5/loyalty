import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { requirePermission } from "@/lib/me";
import { PageHeader } from "@/components/ui";
import { InviteBusinessForm, type InvitePrefill } from "./InviteBusinessForm";

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<InvitePrefill>;
}) {
  await requirePermission(PLATFORM_PERMISSIONS.BUSINESS_MANAGE);
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
      <InviteBusinessForm prefill={prefill} />
    </div>
  );
}
