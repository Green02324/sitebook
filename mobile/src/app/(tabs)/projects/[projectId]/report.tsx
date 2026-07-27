import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { api, API_URL, authHeaders, withAuthRetry } from "@/api";
import { formatCents } from "@/lib/money";
import type { Project, ReportResponse } from "@/types";

export default function ReportScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  function query() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<ReportResponse>(`/projects/${projectId}/report${query()}`)
      .then(setReport)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dateFrom, dateTo]);

  useFocusEffect(
    useCallback(() => {
      api.get<Project>(`/projects/${projectId}`).then(setProject);
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]),
  );

  async function handleShare() {
    setSharing(true);
    try {
      const safeName = (project?.name ?? "report").replace(/[^a-z0-9-_ ]/gi, "");
      const destination = new File(Paths.cache, `${safeName}-report.pdf`);
      await withAuthRetry(() =>
        File.downloadFileAsync(`${API_URL}/api/projects/${projectId}/report/pdf${query()}`, destination, {
          headers: authHeaders(),
          idempotent: true,
        }),
      );
      await Sharing.shareAsync(destination.uri);
    } catch (err) {
      Alert.alert("Couldn't share report", (err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  if (loading || !report) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const totalCredits = report.credits.reduce((s, c) => s + c.subtotalCents, 0);
  const totalDebits = report.debits.reduce((s, d) => s + d.subtotalCents, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{report.projectName}</Text>
      <Pressable style={styles.shareButton} onPress={handleShare} disabled={sharing}>
        <Text style={styles.shareButtonText}>{sharing ? "Preparing…" : "Share PDF"}</Text>
      </Pressable>

      <View style={styles.filterRow}>
        <TextInput style={styles.dateInput} placeholder="From (YYYY-MM-DD)" value={dateFrom} onChangeText={setDateFrom} />
        <TextInput style={styles.dateInput} placeholder="To (YYYY-MM-DD)" value={dateTo} onChangeText={setDateTo} />
        <Pressable style={styles.applyButton} onPress={load}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credits by Category</Text>
        {report.credits.map((c) => (
          <View key={c.categoryName} style={styles.lineRow}>
            <Text style={styles.lineLabel}>{c.categoryName}</Text>
            <Text style={styles.creditAmount}>{formatCents(c.subtotalCents)}</Text>
          </View>
        ))}
        {report.credits.length === 0 && <Text style={styles.none}>None</Text>}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.creditAmount}>{formatCents(totalCredits)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debits by Category</Text>
        {report.debits.map((d) => (
          <View key={d.categoryName} style={styles.lineRow}>
            <Text style={styles.lineLabel}>{d.categoryName}</Text>
            <Text style={styles.debitAmount}>{formatCents(d.subtotalCents)}</Text>
          </View>
        ))}
        {report.debits.length === 0 && <Text style={styles.none}>None</Text>}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.debitAmount}>{formatCents(totalDebits)}</Text>
        </View>
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net Profit</Text>
        <Text style={[styles.netValue, report.netCents >= 0 ? styles.positive : styles.negative]}>{formatCents(report.netCents)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  shareButton: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  shareButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  dateInput: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  applyButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  applyButtonText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  section: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  lineLabel: { fontSize: 13, color: "#475569" },
  none: { fontSize: 12, color: "#94a3b8" },
  creditAmount: { fontSize: 13, fontWeight: "600", color: "#059669" },
  debitAmount: { fontSize: 13, fontWeight: "600", color: "#e11d48" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  netLabel: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  netValue: { fontSize: 16, fontWeight: "800" },
  positive: { color: "#059669" },
  negative: { color: "#e11d48" },
});
