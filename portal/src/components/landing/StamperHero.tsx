"use client";

import { useCallback, useState } from "react";
import { Stamper3D } from "./Stamper3D";
import { Flower } from "./icons";

const STAMPS_PER_CARD = 10;

/**
 * The hero's right-hand side: the 3D stamper with a sample card beside it.
 * Each press of the stamper lands a stamp on the card; the tenth unlocks the
 * reward, and the next press starts a fresh card. It shows the product in
 * one gesture.
 */
export function StamperHero({
  modelLabel,
  hint,
  shopName,
  shopInitial,
  stampCount,
  reward,
  rewardUnlocked,
  startAt = 6,
}: {
  modelLabel: string;
  hint: string;
  shopName: string;
  shopInitial: string;
  /** Contains `{count}`, e.g. "{count} of 10 stamps". */
  stampCount: string;
  reward: string;
  rewardUnlocked: string;
  startAt?: number;
}) {
  const [count, setCount] = useState(startAt);
  const [pulse, setPulse] = useState(0);
  const full = count >= STAMPS_PER_CARD;

  const onStamp = useCallback(() => {
    setCount((c) => (c >= STAMPS_PER_CARD ? 1 : c + 1));
    setPulse((p) => p + 1);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Backdrop: a Stamp Orange sun behind the stamper, with a Honey glow. */}
      <div aria-hidden className="absolute inset-[6%] rounded-full bg-brand-500" />
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_30%_25%,rgb(var(--accent-300)/0.85),transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[repeating-radial-gradient(circle_at_center,transparent_0_22px,rgb(255_255_255/0.07)_22px_23px)]"
      />

      <Stamper3D label={modelLabel} onStamp={onStamp} className="relative aspect-square w-full" />

      <p className="pointer-events-none absolute end-2 top-3 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-crema shadow-lg sm:end-0 sm:top-6">
        {hint}
      </p>

      {/* The sample card, in front of the stamper's lower corner. */}
      <div
        className="animate-float absolute -bottom-14 start-0 w-[min(72%,280px)] [--float-rotate:-4deg] sm:-start-10 md:-bottom-16"
        aria-live="polite"
      >
        <div className="rounded-3xl bg-white p-4 shadow-[0_24px_60px_-20px_rgb(var(--ink-900)/0.45)] ring-1 ring-ink/5 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-100 font-display text-lg font-bold text-accent-700">
              {shopInitial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display font-semibold text-ink">{shopName}</p>
              <p className="text-xs text-ink-500">{stampCount.replace("{count}", String(count))}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden>
            {Array.from({ length: STAMPS_PER_CARD }, (_, i) => {
              const filled = i < count;
              const isNewest = i === count - 1 && pulse > 0;
              const isReward = i === STAMPS_PER_CARD - 1;
              return (
                <span
                  key={i}
                  className={`relative flex aspect-square items-center justify-center rounded-full ${
                    filled
                      ? full
                        ? "bg-mint text-white"
                        : "bg-brand-500 text-white"
                      : isReward
                        ? "border-2 border-dashed border-accent-300 text-accent-500"
                        : "border-2 border-dashed border-ink-200"
                  }`}
                >
                  {filled ? (
                    <span
                      key={isNewest ? pulse : "still"}
                      className={isNewest ? "animate-stamp-in" : ""}
                    >
                      <Flower className="h-4 w-4" />
                    </span>
                  ) : isReward ? (
                    <GiftDot />
                  ) : null}
                  {isNewest ? (
                    <span
                      key={`ring-${pulse}`}
                      className="animate-ink-ring absolute inset-0 rounded-full border-2 border-brand-500"
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              full ? "bg-mint-50 text-mint-800" : "bg-accent-50 text-accent-800"
            }`}
          >
            {full ? rewardUnlocked : reward}
          </p>
        </div>
      </div>
    </div>
  );
}

function GiftDot() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12v8H4v-8M2 7h20v5H2zM12 20V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" />
    </svg>
  );
}
