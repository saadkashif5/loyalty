import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { CreateRewardForm } from "./CreateRewardForm";

interface Reward {
  _id: string;
  name: string;
  description?: string;
  type: string;
  requiredStamps: number;
  status: string;
}

interface Program {
  _id: string;
  name: string;
  requiredStamps: number;
}

export default async function RewardsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const [rewards, programs] = await Promise.all([
    apiFetch<Reward[]>(`/businesses/${businessId}/rewards`),
    apiFetch<Program[]>(`/businesses/${businessId}/programs`),
  ]);

  return (
    <>
      <PageHeader
        title="Rewards"
        description="What a customer receives once they complete a program."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {rewards.length === 0 ? (
            <EmptyState>No rewards yet. Add one so completed cards unlock something.</EmptyState>
          ) : (
            rewards.map((reward) => (
              <Card key={reward._id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{reward.name}</p>
                    {reward.description ? (
                      <p className="mt-1 text-sm text-ink-500">{reward.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-ink-600">
                      {reward.type} · unlocks at {reward.requiredStamps} stamps
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={reward.status} />
                    <Link
                      href={`/b/${businessId}/rewards/${reward._id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <CreateRewardForm businessId={businessId} programs={programs} />
      </div>
    </>
  );
}
