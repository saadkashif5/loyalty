import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
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

// The "Fresh Ink" board. Buttons use Ember (brand), not Stamp Orange: white
// text on Stamp Orange is too faint at button sizes.
export const colors = {
  /** Ember: solid buttons, active tabs, links. */
  brand: "#D63A0A",
  /** Pressed buttons. */
  brandDark: "#B02E08",
  /** Stamp Orange: stamps, the logo, accents. */
  stamp: "#FF5A1F",
  /** Midnight Ink: text and dark surfaces. */
  text: "#151A33",
  /** Steam, a shade darker for small text. */
  muted: "#656C87",
  border: "#E6E8EF",
  surface: "#FFFFFF",
  /** Crema. */
  background: "#FFF6EA",
  danger: "#DC2626",
  /** Mint Reward, darkened for text. */
  success: "#178A6C",
  /** Mint Reward. */
  reward: "#2ED3A6",
  /** Honey. */
  highlight: "#FFC24B",
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

/** A password field with an eye button to show or hide what was typed. */
export function PasswordInput(props: Omit<TextInputProps, "secureTextEntry">) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordRow}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!visible}
        style={[styles.input, styles.passwordInput]}
        placeholderTextColor={colors.muted}
      />
      <Pressable
        onPress={() => setVisible(!visible)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={8}
        style={styles.passwordToggle}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 4, letterSpacing: -0.3 },
  muted: { fontSize: 14, color: colors.muted },
  error: { fontSize: 14, color: colors.danger, marginTop: 8 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonPressed: { opacity: 0.75 },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  buttonLabelGhost: { color: colors.brand },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.surface,
    marginTop: 6,
  },
  passwordRow: { justifyContent: "center" },
  passwordInput: { paddingRight: 44 },
  passwordToggle: {
    position: "absolute",
    right: 0,
    top: 6,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stampGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  stampDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stampDotFilled: { backgroundColor: colors.stamp, borderColor: colors.stamp },
});
