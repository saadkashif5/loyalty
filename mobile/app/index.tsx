import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Input, Muted, Screen, Title, colors } from "@/components/ui";

export default function WelcomeScreen() {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
      } else {
        await signUp(name.trim(), email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Title>TapTapSell Loyalty</Title>
          <Muted>Tap your phone at the counter. Collect stamps. Earn rewards.</Muted>

          <View style={{ height: 24 }} />

          <Card>
            {mode === "signUp" ? (
              <>
                <Text>Your name</Text>
                <Input value={name} onChangeText={setName} autoCapitalize="words" />
                <View style={{ height: 12 }} />
              </>
            ) : null}

            <Text>Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <View style={{ height: 12 }} />

            <Text>Password</Text>
            <Input value={password} onChangeText={setPassword} secureTextEntry />

            <ErrorText>{error}</ErrorText>

            <Button
              label={mode === "signIn" ? "Sign in" : "Create account"}
              onPress={submit}
              loading={busy}
            />
            <Button
              variant="ghost"
              label={mode === "signIn" ? "I need an account" : "I already have an account"}
              onPress={() => {
                setMode(mode === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
            />
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
