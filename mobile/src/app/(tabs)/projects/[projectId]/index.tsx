import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { TransactionListItem } from "@/components/TransactionListItem";
import { formatCents } from "@/lib/money";
import type { Category, ComparisonRow, Project, Transaction } from "@/types";

type ViewMode = "ESTIMATE" | "ACTUAL" | "COMPARISON";

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode, setMode] = useState<ViewMode>("ESTIMATE");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjectAndCategories = useCallback(() => {
    Promise.all([api.get<Project>(`/projects/${projectId}`), api.get<Category[]>(`/projects/${projectId}/categories`)]).then(
      ([p, c]) => {
        setProject(p);
        setCategories(c);
      },
    );
  }, [projectId]);

  const loadList = useCallback(() => {
    setLoading(true);
    if (mode === "COMPARISON") {
      api
        .get<ComparisonRow[]>(`/projects/${projectId}/comparison`)
        .then(setComparison)
        .finally(() => setLoading(false));
    } else {
      api
        .get<Transaction[]>(`/projects/${projectId}/transactions?mode=${mode}`)
        .then(setTransactions)
        .finally(() => setLoading(false));
    }
  }, [projectId, mode]);

  useFocusEffect(useCallback(() => loadProjectAndCategories(), [loadProjectAndCategories]));
  useFocusEffect(useCallback(() => loadList(), [loadList]));

  async function handleDelete(tx: Transaction) {
    await api.delete(`/projects/${projectId}/transactions/${tx.id}`);
    loadList();
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>{project.name}</Text>
          <ProjectStatusBadge status={project.status} />
        </View>
        {project.description ? <Text style={styles.description}>{project.description}</Text> : null}
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push(`/projects/${projectId}/report`)}>
            <Text style={styles.headerAction}>Report</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/manage-categories-modal", params: { projectId } })}>
            <Text style={styles.headerAction}>Categories</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.segmentWrapper}>
        <SegmentedControl<ViewMode>
          options={[
            { label: "Estimate", value: "ESTIMATE" },
            { label: "Actuals", value: "ACTUAL" },
            { label: "Comparison", value: "COMPARISON" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      {mode === "COMPARISON" ? (
        <FlatList
          data={comparison}
          keyExtractor={(r) => r.categoryId ?? "uncategorized"}
          contentContainerStyle={styles.list}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>No data yet.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonCategory}>{item.categoryName}</Text>
              <Text style={styles.comparisonLabel}>
                Debit: est {formatCents(item.estimateDebitCents)} / act {formatCents(item.actualDebitCents)}
              </Text>
              <Text style={styles.comparisonLabel}>
                Credit: est {formatCents(item.estimateCreditCents)} / act {formatCents(item.actualCreditCents)}
              </Text>
            </View>
          )}
        />
      ) : (
        <>
          <FlatList
            data={transactions}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={!loading ? <Text style={styles.empty}>No transactions yet.</Text> : null}
            renderItem={({ item }) => (
              <TransactionListItem
                transaction={item}
                onPress={() =>
                  router.push({ pathname: "/transaction-modal", params: { projectId, mode, transaction: JSON.stringify(item) } })
                }
                onDelete={() => handleDelete(item)}
              />
            )}
          />
          <Pressable
            style={styles.fab}
            onPress={() => router.push({ pathname: "/transaction-modal", params: { projectId, mode } })}
          >
            <Text style={styles.fabText}>+ Add {mode === "ESTIMATE" ? "Estimate" : "Entry"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  header: { padding: 16, gap: 6, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  description: { fontSize: 13, color: "#64748b" },
  headerActions: { flexDirection: "row", gap: 16, marginTop: 4 },
  headerAction: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
  segmentWrapper: { padding: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 90 },
  empty: { padding: 40, textAlign: "center", color: "#94a3b8" },
  comparisonRow: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", padding: 12, marginBottom: 10, gap: 4 },
  comparisonCategory: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  comparisonLabel: { fontSize: 12, color: "#64748b" },
  fab: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
