"use client";

import { useCallback, useEffect, useState } from "react";
import { getCounterCodeAction, type CounterCodeResult } from "@/app/actions";
import { Button, Card, ErrorText } from "./ui";

// Codes live a few minutes; refreshing every minute keeps one on screen that
// will not expire while staff are reading it.
const REFRESH_MS = 60_000;

/** For phones that cannot tap: a code staff scan or type at the counter. */
export function CounterCodePanel({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CounterCodeResult>({});

  const load = useCallback(async () => {
    setState(await getCounterCodeAction(cardId));
  }, [cardId]);

  useEffect(() => {
    if (!open) return;
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, load]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700"
      >
        Phone can&apos;t tap? Show a code at the counter
      </button>
    );
  }

  return (
    <Card className="space-y-3 text-center">
      <p className="text-sm font-medium text-slate-700">Show this to the staff</p>
      {state.qrDataUrl ? (
        // A data URL made on the server; next/image adds nothing here.
        <img src={state.qrDataUrl} alt="" width={220} height={220} className="mx-auto" />
      ) : (
        <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-lg bg-slate-100" />
      )}
      <p className="font-mono text-3xl tracking-[0.3em]">{state.code ?? "········"}</p>
      <p className="text-xs text-slate-500">The code changes every few minutes and works once.</p>
      <ErrorText>{state.error}</ErrorText>
      <Button type="button" onClick={() => setOpen(false)} className="bg-slate-600">
        Done
      </Button>
    </Card>
  );
}
