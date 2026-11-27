import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { EditProgramForm, type EditableProgram, type ProgramFeatures } from "../../EditForms";

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ businessId: string; programId: string }>;
}) {
  const { businessId, programId } = await params;
  const [program, features] = await Promise.all([
    apiFetch<EditableProgram>(`/businesses/${businessId}/programs/${programId}`),
    apiFetch<ProgramFeatures>(`/businesses/${businessId}/features`),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href={`/b/${businessId}/programs`} className="text-sm text-ink-500 hover:text-ink-900">
        ← Programs
      </Link>
      <PageHeader title={`Edit ${program.name}`} />
      <Card>
        <EditProgramForm businessId={businessId} program={program} features={features} />
      </Card>
    </div>
  );
}
