import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, Modal, TextInput, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/api";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import type { Project, ProjectStatus } from "@/types";

const STATUSES: ProjectStatus[] = ["PLANNING", "ACTIVE", "COMPLETED"];

export default function ProjectsListScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Project[]>("/projects")
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  async function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api.post("/projects", { name, description: description || undefined, status });
      setShowCreate(false);
      setName("");
      setDescription("");
      setStatus("PLANNING");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No projects yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/projects/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <ProjectStatusBadge status={item.status} />
            </View>
            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>{item._count?.transactions ?? 0} transactions</Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>+ New Project</Text>
      </Pressable>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCreate(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>New Project</Text>
            <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={styles.statusRow}>
              {STATUSES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.statusOption, status === s && styles.statusOptionActive]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusOptionText, status === s && styles.statusOptionTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.createButton} onPress={handleCreate} disabled={saving}>
                <Text style={styles.createButtonText}>{saving ? "Creating…" : "Create"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, marginBottom: 12, gap: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardDescription: { fontSize: 13, color: "#64748b" },
  cardMeta: { fontSize: 11, color: "#94a3b8" },
  empty: { padding: 40, textAlign: "center", color: "#94a3b8" },
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusOption: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  statusOptionActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  statusOptionText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  statusOptionTextActive: { color: "#fff" },
  error: { color: "#e11d48", fontSize: 13 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelButtonText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  createButton: { flex: 1, backgroundColor: "#4f46e5", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
