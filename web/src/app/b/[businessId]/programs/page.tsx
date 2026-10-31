import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { CreateProgramForm } from "./CreateProgramForm";

interface Program {
  _id: string;
  name: string;
  description?: string;
  requiredStamps: number;
  status: string;
  settings?: { minMinutesBetweenStamps?: number };
}

export default async function ProgramsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const programs = await apiFetch<Program[]>(`/businesses/${businessId}/programs`);

  return (
    <>
      <PageHeader
        title="Loyalty programs"
        description="Set how many stamps a customer needs before a reward unlocks."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {programs.length === 0 ? (
            <EmptyState>No programs yet. Create your first one to start stamping.</EmptyState>
          ) : (
            programs.map((program) => (
              <Card key={program._id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{program.name}</p>
                    {program.description ? (
                      <p className="mt-1 text-sm text-slate-500">{program.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-600">
                      {program.requiredStamps} stamps to unlock a reward
                      {program.settings?.minMinutesBetweenStamps
                        ? ` · ${program.settings.minMinutesBetweenStamps} min between stamps`
                        : null}
                    </p>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
              </Card>
            ))
          )}
        </div>

        <CreateProgramForm businessId={businessId} />
      </div>
    </>
  );
}
