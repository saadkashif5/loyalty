import { useEffect, useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { Link } from "expo-router";
import { ApiError, apiFetch } from "@/lib/api";
import { Card, ErrorText, Input, Muted, Screen, colors } from "@/components/ui";

interface PublicBusiness {
  _id: string;
  name: string;
  category: string;
  description?: string;
}

export default function DiscoverScreen() {
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Debounced so typing does not fire a request per keystroke.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setError(null);
          setBusinesses(
            await apiFetch<PublicBusiness[]>(
              `/discover/businesses?q=${encodeURIComponent(query)}`,
              { anonymous: true },
            ),
          );
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Could not load businesses.");
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Screen>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search cafés, salons, bakeries…"
        autoCapitalize="none"
      />

      <ErrorText>{error}</ErrorText>

      <FlatList
        style={{ marginTop: 12 }}
        data={businesses}
        keyExtractor={(business) => business._id}
        ListEmptyComponent={<Muted>No businesses found.</Muted>}
        renderItem={({ item }) => (
          <Link href={`/business/${item._id}`} asChild>
            <Pressable>
              <Card>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {item.name}
                </Text>
                <Muted>{item.category}</Muted>
              </Card>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}
