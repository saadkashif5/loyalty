"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { mintDevicesAction } from "@/app/actions";
import { Button, Card, ErrorText, Field, Input, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create stampers"}
    </Button>
  );
}

export function MintForm() {
  const [state, formAction] = useActionState(mintDevicesAction, {});

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Create stampers</h2>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field label="How many">
          <Input
            name="quantity"
            type="number"
            min={1}
            max={100}
            defaultValue={10}
            required
            className="w-28"
          />
        </Field>
        <Field label="Tag">
          <Select name="tagType" defaultValue="NTAG21X_MIRROR">
            <option value="NTAG21X_MIRROR">NTAG 215 (counter mirror)</option>
            <option value="STATIC">Static (legacy)</option>
          </Select>
        </Field>
        <Submit />
      </form>
      <ErrorText>{state.error}</ErrorText>

      {state.devices ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-700">
            Write each identifier onto its tag (see docs/stamper-provisioning.md) and print the
            activation code with it. <strong>Activation codes are shown only now.</strong>
          </p>
          <table className="w-full max-w-md text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Stamper</th>
                <th className="py-1">Activation code</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {state.devices.map((d) => (
                <tr key={d.deviceIdentifier}>
                  <td className="py-1">{d.deviceIdentifier}</td>
                  <td className="py-1">{d.activationCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
