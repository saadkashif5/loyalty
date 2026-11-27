import Link from "next/link";
import { redirect } from "next/navigation";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { BRAND } from "@taptapsell/brand";
import { apiFetch } from "@/lib/api";
import { can, getMembership } from "@/lib/membership";
import { Card, PageHeader } from "@/components/ui";
import { SETUP_STEPS, type OnboardingStatus } from "../SetupChecklist";
import { BusinessProfileForm, type BusinessProfile } from "../settings/BusinessProfileForm";
import { CreateBranchForm } from "../branches/CreateBranchForm";
import { CreateProgramForm } from "../programs/CreateProgramForm";
import { CreateRewardForm } from "../rewards/CreateRewardForm";
import { ActivateDeviceForm } from "../devices/ActivateDeviceForm";
import { InviteMemberForm } from "../staff/InviteMemberForm";

type StepKey = (typeof SETUP_STEPS)[number]["key"];

export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { businessId } = await params;
  const { step: requested } = await searchParams;
  const { role } = await getMembership(businessId);
  if (!can(role, BUSINESS_PERMISSIONS.PROGRAM_MANAGE)) redirect(`/b/${businessId}`);

  const [status, profile, branches, programs] = await Promise.all([
    apiFetch<OnboardingStatus>(`/businesses/${businessId}/onboarding`),
    apiFetch<BusinessProfile>(`/businesses/${businessId}`),
    apiFetch<Array<{ _id: string; name: string }>>(`/businesses/${businessId}/branches`),
    apiFetch<Array<{ _id: string; name: string; requiredStamps: number }>>(
      `/businesses/${businessId}/programs`,
    ),
  ]);

  // The first unfinished required step, unless the owner picked one. Optional
  // steps (staff) never hold up "ready"; they stay reachable from the list.
  const firstOpen = SETUP_STEPS.find((s) => !s.optional && !status.steps[s.key])?.key ?? null;
  const current: StepKey | null = SETUP_STEPS.some((s) => s.key === requested)
    ? (requested as StepKey)
    : firstOpen;
  const index = SETUP_STEPS.findIndex((s) => s.key === current);
  const next = index >= 0 ? SETUP_STEPS[index + 1] : undefined;

  return (
    <>
      <PageHeader
        title="Set up your business"
        description="A few steps, then customers can start collecting stamps."
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ol className="space-y-1">
          {SETUP_STEPS.map((s, i) => (
            <li key={s.key}>
              <Link
                href={`/b/${businessId}/setup?step=${s.key}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                  s.key === current ? "bg-white font-medium shadow-sm" : "hover:bg-white"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    status.steps[s.key]
                      ? "bg-mint-100 text-mint-700"
                      : "border border-ink-300 text-ink-500"
                  }`}
                >
                  {status.steps[s.key] ? "✓" : i + 1}
                </span>
                <span>
                  {s.label}
                  <span className="block text-xs font-normal text-ink-500">{s.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="space-y-4">
          {current === null ? (
            <Card className="space-y-2">
              <p className="font-semibold text-mint-700">You are ready.</p>
              <p className="text-sm text-ink-600">
                Put the stamper on your counter. Customers tap it with their phone to join and
                collect stamps.
              </p>
              <Link
                href={`/b/${businessId}`}
                className="inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Go to the overview →
              </Link>
            </Card>
          ) : null}

          {current === "profile" ? (
            <Card>
              <h2 className="mb-4 font-semibold">Business details</h2>
              <BusinessProfileForm businessId={businessId} profile={profile} />
            </Card>
          ) : null}

          {current === "branch" ? <CreateBranchForm businessId={businessId} /> : null}

          {current === "program" ? (
            <>
              <p className="text-sm text-ink-600">
                A program sets how many stamps fill a card — for example 6 stamps for a free chai.
              </p>
              <CreateProgramForm businessId={businessId} />
            </>
          ) : null}

          {current === "reward" ? (
            programs.length === 0 ? (
              <Card className="text-sm text-ink-600">Create a loyalty program first.</Card>
            ) : (
              <CreateRewardForm businessId={businessId} programs={programs} />
            )
          ) : null}

          {current === "stamper" ? (
            <>
              <p className="text-sm text-ink-600">
                Your stamper comes from {BRAND.name} with a stamper ID and an activation code. Not
                received it yet? You can finish the other steps and come back.
              </p>
              {branches.length === 0 ? (
                <Card className="text-sm text-ink-600">Add a branch first.</Card>
              ) : (
                <ActivateDeviceForm businessId={businessId} branches={branches} />
              )}
            </>
          ) : null}

          {current === "staff" ? (
            <>
              <p className="text-sm text-ink-600">
                Optional. The person needs a {BRAND.name} account first; they accept the invitation
                when they next sign in.
              </p>
              <InviteMemberForm businessId={businessId} />
            </>
          ) : null}

          {current !== null && status.steps[current] ? (
            <p className="text-sm text-mint-700">This step is done.</p>
          ) : null}
          {current !== null ? (
            <Link
              href={next ? `/b/${businessId}/setup?step=${next.key}` : `/b/${businessId}`}
              className="inline-block text-sm text-ink-500 hover:text-ink-900"
            >
              {next ? `Skip to: ${next.label} →` : "Finish later →"}
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
