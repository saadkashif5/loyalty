import { FlatList, Text } from "react-native";
import { useAuth } from "@/lib/auth";
import { useApiQuery } from "@/lib/useApi";
import { Button, Card, Muted, Screen, Title, colors } from "@/components/ui";

interface Stamp {
  _id: string;
  createdAt: string;
  source: string;
  businessId: { name: string } | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data } = useApiQuery<Stamp[]>("/stamps/me");

  return (
    <Screen>
      <Card>
        <Title>{user?.name}</Title>
        <Muted>{user?.email}</Muted>
        <Button variant="ghost" label="Sign out" onPress={() => void signOut()} />
      </Card>

      <Text style={{ marginBottom: 8, fontWeight: "600", color: colors.text }}>
        Stamp history
      </Text>

      <FlatList
        data={data ?? []}
        keyExtractor={(stamp) => stamp._id}
        ListEmptyComponent={<Muted>No stamps yet.</Muted>}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ color: colors.text }}>{item.businessId?.name ?? "Business"}</Text>
            <Muted>
              {new Date(item.createdAt).toLocaleString("en-PK", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · {item.source}
            </Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
