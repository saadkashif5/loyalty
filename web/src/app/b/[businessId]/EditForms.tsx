"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateBranchAction,
  updateProgramAction,
  updateRewardAction,
} from "@/app/actions/business";
import { Button, ErrorText, Field, Input, SavedText, Select, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function StatusSelect({ value, activeLabel }: { value: string; activeLabel: string }) {
  return (
    <Field label="Status">
      <Select name="status" defaultValue={value}>
        <option value="ACTIVE">{activeLabel}</option>
        <option value="INACTIVE">Paused</option>
      </Select>
    </Field>
  );
}

export interface EditableProgram {
  _id: string;
  name: string;
  description?: string;
  terms?: string;
  requiredStamps: number;
  status: string;
  settings?: {
    minMinutesBetweenStamps?: number;
    maxStampsPerDay?: number;
    stampExpiryDays?: number | null;
  };
}

export function EditProgramForm({
  businessId,
  program,
}: {
  businessId: string;
  program: EditableProgram;
}) {
  const [state, formAction] = useActionState(
    updateProgramAction.bind(null, businessId, program._id),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input name="name" required defaultValue={program.name} />
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={2} defaultValue={program.description} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Stamps per card">
          <Input
            name="requiredStamps"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={program.requiredStamps}
          />
        </Field>
        <Field label="Minutes between stamps">
          <Input
            name="minMinutesBetweenStamps"
            type="number"
            min={0}
            max={1440}
            required
            defaultValue={program.settings?.minMinutesBetweenStamps ?? 5}
          />
        </Field>
        <Field label="Most stamps per day">
          <Input
            name="maxStampsPerDay"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={program.settings?.maxStampsPerDay ?? 3}
          />
        </Field>
        <StatusSelect value={program.status} activeLabel="Running" />
      </div>
      <Field label="Stamps expire after this many days without a visit (blank = never)">
        <Input
          name="stampExpiryDays"
          type="number"
          min={7}
          max={730}
          placeholder="Never"
          defaultValue={program.settings?.stampExpiryDays ?? undefined}
          className="max-w-[10rem]"
        />
      </Field>
      <Field label="Terms shown to customers">
        <Textarea name="terms" rows={3} defaultValue={program.terms} />
      </Field>
      <p className="text-xs text-slate-500">
        Pausing stops new stamps for this program. Cards and earned rewards are kept.
      </p>
      <ErrorText>{state.error}</ErrorText>
      <SavedText show={state.saved} />
      <Submit />
    </form>
  );
}

export interface EditableReward {
  _id: string;
  name: string;
  description?: string;
  type: string;
  requiredStamps: number;
  status: string;
  validForDays?: number;
}

export function EditRewardForm({
  businessId,
  reward,
  maxStamps,
}: {
  businessId: string;
  reward: EditableReward;
  maxStamps: number;
}) {
  const [state, formAction] = useActionState(
    updateRewardAction.bind(null, businessId, reward._id),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input name="name" required defaultValue={reward.name} />
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={2} defaultValue={reward.description} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type">
          <Select name="type" defaultValue={reward.type}>
            <option value="FREE_ITEM">Free item</option>
            <option value="PERCENT_OFF">Percent off</option>
            <option value="FIXED_DISCOUNT">Rupees off</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label={`Unlocks at (max ${maxStamps})`}>
          <Input
            name="requiredStamps"
            type="number"
            min={1}
            max={maxStamps}
            required
            defaultValue={reward.requiredStamps}
          />
        </Field>
        <StatusSelect value={reward.status} activeLabel="Available" />
      </div>
      <Field label="Days to use it once unlocked (blank = never expires)">
        <Input
          name="validForDays"
          type="number"
          min={1}
          max={365}
          defaultValue={reward.validForDays}
        />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SavedText show={state.saved} />
      <Submit />
    </form>
  );
}

export interface EditableBranch {
  _id: string;
  name: string;
  address?: string;
  status: string;
  openingHours?: Array<{ day: number; open: string; close: string }>;
}

// Monday first, as the week is written in Pakistan.
const WEEK: Array<[number, string]> = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
];

function OpeningHoursFields({ hours }: { hours: EditableBranch["openingHours"] }) {
  const byDay = new Map((hours ?? []).map((h) => [h.day, h]));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Opening hours</legend>
      <p className="text-xs text-slate-500">
        Leave a day blank if you are closed. A closing time earlier than the opening time runs past
        midnight. Stamps given while closed show up under Alerts. Leave every day blank to switch
        this off.
      </p>
      {WEEK.map(([day, label]) => (
        <div key={day} className="flex items-center gap-2 text-sm">
          <span className="w-24 text-slate-600">{label}</span>
          <Input
            name={`open-${day}`}
            type="time"
            aria-label={`${label} opens`}
            defaultValue={byDay.get(day)?.open}
            className="w-32"
          />
          <span className="text-slate-400">to</span>
          <Input
            name={`close-${day}`}
            type="time"
            aria-label={`${label} closes`}
            defaultValue={byDay.get(day)?.close}
            className="w-32"
          />
        </div>
      ))}
    </fieldset>
  );
}

export function EditBranchForm({
  businessId,
  branch,
}: {
  businessId: string;
  branch: EditableBranch;
}) {
  const [state, formAction] = useActionState(
    updateBranchAction.bind(null, businessId, branch._id),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input name="name" required defaultValue={branch.name} />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={branch.address} />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={branch.status}>
          <option value="ACTIVE">Open</option>
          <option value="INACTIVE">Closed</option>
        </Select>
      </Field>
      <OpeningHoursFields hours={branch.openingHours} />
      <ErrorText>{state.error}</ErrorText>
      <SavedText show={state.saved} />
      <Submit />
    </form>
  );
}
