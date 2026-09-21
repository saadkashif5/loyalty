import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useApiQuery } from "@/lib/useApi";
import { Button, Card, ErrorText, Muted, Screen, StampProgress, colors } from "@/components/ui";

interface LoyaltyCard {
  _id: string;
  stampCount: number;
  businessId: { _id: string; name: string } | null;
  programId: { _id: string; name: string; requiredStamps: number } | null;
}

export default function CardsScreen() {
  const router = useRouter();
  const { data, error, loading, refresh } = useApiQuery<LoyaltyCard[]>("/loyalty-cards");

  return (
    <Screen>
      <Button label="Tap to collect a stamp" onPress={() => router.push("/scan")} />

      <View style={{ height: 16 }} />

      <ErrorText>{error}</ErrorText>

      <FlatList
        data={data ?? []}
        keyExtractor={(card) => card._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Muted>
                No loyalty cards yet. Find a business in Discover, or scan the QR code on a
                stamper at the counter.
              </Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Link href={`/card/${item._id}`} asChild>
            <Pressable>
              <Card>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {item.businessId?.name ?? "Business"}
                </Text>
                <Muted>{item.programId?.name}</Muted>
                <StampProgress
                  current={item.stampCount}
                  required={item.programId?.requiredStamps ?? 0}
                />
                <Text style={{ marginTop: 10, color: colors.muted, fontSize: 13 }}>
                  {item.stampCount} of {item.programId?.requiredStamps} stamps
                </Text>
              </Card>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}
