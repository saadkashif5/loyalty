import { FlatList, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useApiQuery } from "@/lib/useApi";
import { Card, ErrorText, Muted, Screen, StampProgress, Title, colors } from "@/components/ui";

interface CardDetail {
  card: {
    _id: string;
    stampCount: number;
    businessId: { name: string } | null;
    programId: { name: string; description?: string; requiredStamps: number; terms?: string } | null;
  };
  recentStamps: { _id: string; createdAt: string; source: string }[];
  availableRewards: {
    _id: string;
    redemptionCode: string;
    status: string;
    rewardId: { name: string } | null;
  }[];
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useApiQuery<CardDetail>(`/loyalty-cards/${id}`);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: data?.card.businessId?.name ?? "Card" }} />
      <ErrorText>{error}</ErrorText>

      {data ? (
        <FlatList
          data={data.recentStamps}
          keyExtractor={(stamp) => stamp._id}
          ListHeaderComponent={
            <View>
              <Card>
                <Title>{data.card.programId?.name}</Title>
                {data.card.programId?.description ? (
                  <Muted>{data.card.programId.description}</Muted>
                ) : null}
                <StampProgress
                  current={data.card.stampCount}
                  required={data.card.programId?.requiredStamps ?? 0}
                />
                <Text style={{ marginTop: 10, color: colors.muted }}>
                  {data.card.stampCount} of {data.card.programId?.requiredStamps} stamps
                </Text>
              </Card>

              {data.availableRewards.length > 0 ? (
                <Card>
                  <Title>Ready to redeem</Title>
                  {data.availableRewards.map((reward) => (
                    <View key={reward._id} style={{ marginTop: 8 }}>
                      <Text style={{ color: colors.text }}>{reward.rewardId?.name}</Text>
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: "700",
                          letterSpacing: 3,
                          color: colors.brand,
                        }}
                      >
                        {reward.redemptionCode}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {data.card.programId?.terms ? (
                <Card>
                  <Muted>{data.card.programId.terms}</Muted>
                </Card>
              ) : null}

              <Text style={{ marginVertical: 8, fontWeight: "600", color: colors.text }}>
                Recent stamps
              </Text>
            </View>
          }
          ListEmptyComponent={<Muted>No stamps collected yet.</Muted>}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ color: colors.text }}>
                {new Date(item.createdAt).toLocaleString("en-PK", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
              <Muted>Collected by {item.source}</Muted>
            </Card>
          )}
        />
      ) : null}
    </Screen>
  );
}
