import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/api";
import { DonutChart } from "@/components/DonutChart";
import { YearSelector } from "@/components/YearSelector";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatCents } from "@/lib/money";
import type { DashboardResponse } from "@/types";

export default function DashboardScreen() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<DashboardResponse>(`/dashboard?year=${year}`)
      .then((res) => {
        setData(res);
        setYear(res.year);
      })
      .finally(() => setLoading(false));
  }, [year]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const selectedProject = data.projects.find((p) => p.id === selectedProjectId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dashboard</Text>
        <YearSelector years={data.availableYears} value={data.year} onChange={setYear} />
      </View>

      <View style={styles.chartCard}>
        <DonutChart
          outer={[
            { name: "Income", value: data.totalIncomeCents },
            { name: "Expenses", value: data.totalExpenseCents },
          ]}
          inner={
            selectedProject
              ? [
                  { name: "Income", value: selectedProject.incomeCents },
                  { name: "Expenses", value: selectedProject.expenseCents },
                ]
              : undefined
          }
          centerLabel={selectedProject ? selectedProject.name : "All projects"}
        />
      </View>

      <Text style={styles.sectionTitle}>Projects</Text>
      <View style={styles.projectList}>
        {data.projects.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.projectRow, selectedProjectId === p.id && styles.projectRowSelected]}
            onPress={() => setSelectedProjectId((cur) => (cur === p.id ? null : p.id))}
          >
            <View style={styles.projectRowLeft}>
              <Text style={styles.projectName}>{p.name}</Text>
              <ProjectStatusBadge status={p.status} />
            </View>
            <View style={styles.projectRowRight}>
              <Text style={[styles.netAmount, p.netCents >= 0 ? styles.positive : styles.negative]}>{formatCents(p.netCents)}</Text>
              <Pressable onPress={() => router.push(`/projects/${p.id}`)} hitSlop={8}>
                <Text style={styles.openLink}>Open →</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
        {data.projects.length === 0 && <Text style={styles.empty}>No projects yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  chartCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  projectList: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  projectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  projectRowSelected: { backgroundColor: "#eef2ff" },
  projectRowLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  projectName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  projectRowRight: { alignItems: "flex-end", gap: 4 },
  netAmount: { fontSize: 14, fontWeight: "700" },
  positive: { color: "#059669" },
  negative: { color: "#e11d48" },
  openLink: { fontSize: 12, fontWeight: "600", color: "#4f46e5" },
  empty: { padding: 20, textAlign: "center", color: "#94a3b8" },
});
