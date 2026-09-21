import { FlatList, RefreshControl, Text, View } from "react-native";
import { useApiQuery } from "@/lib/useApi";
import { Card, ErrorText, Muted, Screen, colors } from "@/components/ui";

interface RedemptionRecord {
  _id: string;
  redemptionCode: string;
  status: string;
  createdAt: string;
  rewardId: { name: string; description?: string } | null;
  businessId: { name: string } | null;
}

export default function RewardsScreen() {
  const { data, error, loading, refresh } =
    useApiQuery<RedemptionRecord[]>("/redemptions/me");

  const pending = (data ?? []).filter((r) => r.status === "PENDING");
  const past = (data ?? []).filter((r) => r.status !== "PENDING");

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>

      <FlatList
        data={pending}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Muted>
                No rewards waiting. Keep collecting stamps — your reward unlocks automatically.
              </Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
              {item.rewardId?.name}
            </Text>
            <Muted>{item.businessId?.name}</Muted>
            <Text style={{ marginTop: 12, fontSize: 13, color: colors.muted }}>
              Show this code at the counter
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 28,
                fontWeight: "700",
                letterSpacing: 4,
                color: colors.brand,
              }}
            >
              {item.redemptionCode}
            </Text>
          </Card>
        )}
        ListFooterComponent={
          past.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ marginBottom: 8, fontWeight: "600", color: colors.text }}>
                Past rewards
              </Text>
              {past.map((item) => (
                <Card key={item._id}>
                  <Text style={{ color: colors.text }}>{item.rewardId?.name}</Text>
                  <Muted>
                    {item.businessId?.name} · {item.status.toLowerCase()}
                  </Muted>
                </Card>
              ))}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
