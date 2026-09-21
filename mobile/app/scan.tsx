import { useCallback, useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError, apiFetch } from "@/lib/api";
import { checkNfcAvailability, readStamperTag, type NfcAvailability } from "@/lib/nfc";
import { Button, Card, Muted, Screen, StampProgress, Title, colors } from "@/components/ui";

interface StampResult {
  alreadyRecorded: boolean;
  card: { id: string; stampCount: number; requiredStamps: number };
  unlockedReward: { redemptionCode: string; rewardName: string } | null;
}

type Phase =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "scanning" }
  | { kind: "submitting" }
  | { kind: "success"; result: StampResult }
  | { kind: "error"; message: string; hint?: string };

// Every distinct tap gets its own key, so a retry after a dropped response
// replays the same request instead of producing a second stamp (§57).
function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const UNAVAILABLE_COPY: Record<Exclude<NfcAvailability, "READY">, { message: string; hint: string }> = {
  DISABLED: {
    message: "NFC is turned off",
    hint:
      Platform.OS === "android"
        ? "Turn on NFC in your phone settings, then try again. You can also scan the QR code on the stamper."
        : "Turn on NFC, then try again. You can also scan the QR code on the stamper.",
  },
  UNSUPPORTED: {
    message: "This phone does not support NFC",
    hint: "Scan the QR code printed on the stamper instead.",
  },
};

export default function ScanScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    void (async () => {
      try {
        const availability = await checkNfcAvailability();
        if (availability === "READY") {
          setPhase({ kind: "ready" });
        } else {
          setPhase({ kind: "error", ...UNAVAILABLE_COPY[availability] });
        }
      } catch {
        setPhase({
          kind: "error",
          message: "Could not start NFC",
          hint: "Scan the QR code printed on the stamper instead.",
        });
      }
    })();
  }, []);

  const scan = useCallback(async () => {
    setPhase({ kind: "scanning" });

    let deviceIdentifier: string;
    try {
      deviceIdentifier = await readStamperTag();
    } catch (err) {
      const unreadable = err instanceof Error && err.message === "UNREADABLE_TAG";
      setPhase({
        kind: "error",
        message: unreadable ? "That is not a loyalty stamper" : "No stamper detected",
        hint: unreadable
          ? "Hold your phone against the TapTapSell stamper on the counter."
          : "Hold your phone steady against the stamper and try again.",
      });
      return;
    }

    setPhase({ kind: "submitting" });

    try {
      const result = await apiFetch<StampResult>("/stamps", {
        method: "POST",
        body: { deviceIdentifier, source: "NFC" },
        idempotencyKey: newIdempotencyKey(),
      });
      setPhase({ kind: "success", result });
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_ENROLLED") {
        setPhase({
          kind: "error",
          message: "You have not joined this program yet",
          hint: "Open the business in Discover and join, then tap again.",
        });
        return;
      }
      setPhase({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Could not add your stamp",
        hint: "Nothing was recorded. Please try again.",
      });
    }
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {phase.kind === "checking" ? <Muted>Checking NFC…</Muted> : null}

        {phase.kind === "ready" || phase.kind === "scanning" ? (
          <Card>
            <Title>{phase.kind === "scanning" ? "Hold against the stamper" : "Ready to tap"}</Title>
            <Muted>
              Touch the back of your phone to the TapTapSell stamper on the counter after you have
              paid.
            </Muted>
            <Button
              label={phase.kind === "scanning" ? "Waiting for stamper…" : "Start"}
              onPress={scan}
              loading={phase.kind === "scanning"}
            />
          </Card>
        ) : null}

        {phase.kind === "submitting" ? (
          <Card>
            <Title>Validating…</Title>
            <Muted>Confirming your stamp with the business.</Muted>
          </Card>
        ) : null}

        {phase.kind === "success" ? (
          <Card>
            <Title>
              {phase.result.unlockedReward
                ? "Reward unlocked!"
                : phase.result.alreadyRecorded
                  ? "Already collected"
                  : "Stamp added"}
            </Title>

            {phase.result.unlockedReward ? (
              <>
                <Muted>{phase.result.unlockedReward.rewardName}</Muted>
                <Text style={{ marginTop: 12, fontSize: 13, color: colors.muted }}>
                  Show this code at the counter
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 28,
                    fontWeight: "700",
                    letterSpacing: 4,
                    color: colors.brand,
                  }}
                >
                  {phase.result.unlockedReward.redemptionCode}
                </Text>
              </>
            ) : (
              <>
                <StampProgress
                  current={phase.result.card.stampCount}
                  required={phase.result.card.requiredStamps}
                />
                <Text style={{ marginTop: 10, color: colors.muted }}>
                  {phase.result.card.stampCount} of {phase.result.card.requiredStamps} stamps
                </Text>
              </>
            )}

            <Button label="Done" onPress={() => router.back()} />
          </Card>
        ) : null}

        {phase.kind === "error" ? (
          <Card>
            <Title>{phase.message}</Title>
            {phase.hint ? <Muted>{phase.hint}</Muted> : null}
            <Button label="Try again" onPress={scan} />
            <Button variant="ghost" label="Close" onPress={() => router.back()} />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
