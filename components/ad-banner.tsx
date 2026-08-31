import { StyleSheet, Text, View } from "react-native";

export function AdBanner({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  return (
    <View accessible accessibilityLabel="광고 배너 미리보기" style={[styles.container, compact && styles.compact, inline && styles.inline]}>
      <Text numberOfLines={1} style={styles.label}>AD · 배너 미리보기</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(19, 37, 65, 0.96)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#3D5A85",
  },
  compact: {
    minHeight: 42,
  },
  inline: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: "#A6B4CE",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
});
