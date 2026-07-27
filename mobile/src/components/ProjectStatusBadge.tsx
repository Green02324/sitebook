import { View, Text, StyleSheet } from "react-native";
import type { ProjectStatus } from "../types";

const STYLES: Record<ProjectStatus, { bg: string; text: string }> = {
  PLANNING: { bg: "#fef3c7", text: "#92400e" },
  ACTIVE: { bg: "#d1fae5", text: "#065f46" },
  COMPLETED: { bg: "#e2e8f0", text: "#334155" },
};

const LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const colors = STYLES[status];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "600" },
});
