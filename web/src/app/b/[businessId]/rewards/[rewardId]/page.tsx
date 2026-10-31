import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { EditRewardForm, type EditableReward } from "../../EditForms";

export default async function EditRewardPage({
  params,
}: {
  params: Promise<{ businessId: string; rewardId: string }>;
}) {
  const { businessId, rewardId } = await params;
  const [rewards, programs] = await Promise.all([
    apiFetch<Array<EditableReward & { programId: string }>>(`/businesses/${businessId}/rewards`),
    apiFetch<Array<{ _id: string; requiredStamps: number }>>(`/businesses/${businessId}/programs`),
  ]);

  const reward = rewards.find((r) => r._id === rewardId);
  if (!reward) notFound();
  const program = programs.find((p) => p._id === reward.programId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/b/${businessId}/rewards`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Rewards
      </Link>
      <PageHeader title={`Edit ${reward.name}`} />
      <Card>
        <EditRewardForm
          businessId={businessId}
          reward={reward}
          maxStamps={program?.requiredStamps ?? 100}
        />
      </Card>
    </div>
  );
}
