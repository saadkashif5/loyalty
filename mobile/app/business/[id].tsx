import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ApiError, apiFetch } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { Button, Card, ErrorText, Muted, Screen, Title, colors } from "@/components/ui";

interface BusinessDetail {
  business: { _id: string; name: string; description?: string; category: string };
  programs: {
    _id: string;
    name: string;
    description?: string;
    requiredStamps: number;
    rewards: { _id: string; name: string }[];
  }[];
}

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useApiQuery<BusinessDetail>(`/discover/businesses/${id}`);
  const [joining, setJoining] = useState<string | null>(null);

  const join = async (programId: string) => {
    setJoining(programId);
    try {
      await apiFetch("/loyalty-cards/join", { method: "POST", body: { programId } });
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert(
        "Could not join",
        err instanceof ApiError ? err.message : "Please try again in a moment.",
      );
    } finally {
      setJoining(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: data?.business.name ?? "Business" }} />
      <ErrorText>{error}</ErrorText>

      {data ? (
        <View>
          <Card>
            <Title>{data.business.name}</Title>
            <Muted>{data.business.description ?? data.business.category}</Muted>
          </Card>

          {data.programs.length === 0 ? (
            <Card>
              <Muted>This business has no loyalty program running right now.</Muted>
            </Card>
          ) : (
            data.programs.map((program) => (
              <Card key={program._id}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {program.name}
                </Text>
                {program.description ? <Muted>{program.description}</Muted> : null}
                <Text style={{ marginTop: 8, color: colors.muted }}>
                  Collect {program.requiredStamps} stamps
                  {program.rewards[0] ? ` to get ${program.rewards[0].name}` : ""}
                </Text>
                <Button
                  label="Join this program"
                  onPress={() => join(program._id)}
                  loading={joining === program._id}
                />
              </Card>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}
