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

export default async function RewardsPage({ params }: { params: { businessId: string } }) {
  const [rewards, programs] = await Promise.all([
    apiFetch<Reward[]>(`/businesses/${params.businessId}/rewards`),
    apiFetch<Program[]>(`/businesses/${params.businessId}/programs`),
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
                      <p className="mt-1 text-sm text-slate-500">{reward.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-600">
                      {reward.type} · unlocks at {reward.requiredStamps} stamps
                    </p>
                  </div>
                  <StatusBadge status={reward.status} />
                </div>
              </Card>
            ))
          )}
        </div>

        <CreateRewardForm businessId={params.businessId} programs={programs} />
      </div>
    </>
  );
}
