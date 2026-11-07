import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

// Mirrors packages/brand/src/index.ts, which this Expo project cannot import.
// Keep the two in step when the brand changes.
export const BRAND_NAME = "Stamply";

export const colors = {
  brand: "#5b2ed6",
  brandDark: "#4a23b0",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#ffffff",
  background: "#f8fafc",
  danger: "#dc2626",
  success: "#047857",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children?: string | null }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Button({
  label,
  onPress,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
}) {
  const isGhost = variant === "ghost";
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        isGhost && styles.buttonGhost,
        (pressed || loading) && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.brand : "#fff"} />
      ) : (
        <Text style={[styles.buttonLabel, isGhost && styles.buttonLabelGhost]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} />;
}

/** Visual stamp progress — the primary thing a customer opens the app to see. */
export function StampProgress({ current, required }: { current: number; required: number }) {
  return (
    <View style={styles.stampGrid}>
      {Array.from({ length: required }, (_, index) => (
        <View
          key={index}
          style={[styles.stampDot, index < current ? styles.stampDotFilled : null]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "600", color: colors.text, marginBottom: 4 },
  muted: { fontSize: 14, color: colors.muted },
  error: { fontSize: 14, color: colors.danger, marginTop: 8 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonPressed: { opacity: 0.75 },
  buttonLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  buttonLabelGhost: { color: colors.brand },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.surface,
    marginTop: 6,
  },
  stampGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  stampDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stampDotFilled: { backgroundColor: colors.brand, borderColor: colors.brand },
});
