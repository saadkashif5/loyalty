import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { EditProgramForm, type EditableProgram } from "../../EditForms";

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ businessId: string; programId: string }>;
}) {
  const { businessId, programId } = await params;
  const program = await apiFetch<EditableProgram>(
    `/businesses/${businessId}/programs/${programId}`,
  );

  return (
    <div className="max-w-3xl">
      <Link
        href={`/b/${businessId}/programs`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Programs
      </Link>
      <PageHeader title={`Edit ${program.name}`} />
      <Card>
        <EditProgramForm businessId={businessId} program={program} />
      </Card>
    </div>
  );
}
