import Link from "next/link";
import { Card } from "@/components/ui";

export interface OnboardingStatus {
  steps: {
    profile: boolean;
    branch: boolean;
    program: boolean;
    reward: boolean;
    stamper: boolean;
    staff: boolean;
  };
  ready: boolean;
}

export const SETUP_STEPS: Array<{
  key: keyof OnboardingStatus["steps"];
  label: string;
  hint: string;
  optional?: boolean;
}> = [
  { key: "profile", label: "Business details", hint: "Phone number and address" },
  { key: "branch", label: "First branch", hint: "Where your stamper will be" },
  { key: "program", label: "Loyalty program", hint: "How many stamps fill a card" },
  { key: "reward", label: "Reward", hint: "What customers earn" },
  { key: "stamper", label: "Activate your stamper", hint: "Using the code that came with it" },
  { key: "staff", label: "Add staff", hint: "Optional — cashiers and managers", optional: true },
];

export function SetupChecklist({
  businessId,
  status,
}: {
  businessId: string;
  status: OnboardingStatus;
}) {
  const done = SETUP_STEPS.filter((s) => status.steps[s.key]).length;

  return (
    <Card className="mb-6 border-brand-500">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Finish setting up</h2>
          <p className="text-sm text-slate-500">
            {done} of {SETUP_STEPS.length} done. Customers can collect stamps once the required
            steps are complete.
          </p>
        </div>
        <Link
          href={`/b/${businessId}/setup`}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Continue setup
        </Link>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SETUP_STEPS.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                status.steps[step.key]
                  ? "bg-emerald-100 text-emerald-700"
                  : "border border-slate-300 text-slate-400"
              }`}
            >
              {status.steps[step.key] ? "✓" : ""}
            </span>
            <span className={status.steps[step.key] ? "text-slate-500 line-through" : ""}>
              {step.label}
              {step.optional ? " (optional)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
