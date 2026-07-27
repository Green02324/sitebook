import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import type { Category } from "@/types";

export default function ManageCategoriesModal() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Category[]>(`/projects/${projectId}/categories`).then(setCategories);
  }, [projectId]);

  useFocusEffect(useCallback(() => load(), [load]));

  async function handleRename(id: string) {
    setError(null);
    try {
      await api.put(`/projects/${projectId}/categories/${id}`, { name: renameValue });
      setRenamingId(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete category?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await api.delete(`/projects/${projectId}/categories/${id}`);
            load();
          } catch (err) {
            setError((err as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No categories yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {renamingId === item.id ? (
              <TextInput
                style={styles.input}
                value={renameValue}
                onChangeText={setRenameValue}
                autoFocus
                onSubmitEditing={() => handleRename(item.id)}
              />
            ) : (
              <Text style={styles.name}>{item.name}</Text>
            )}
            <View style={styles.actions}>
              {renamingId === item.id ? (
                <Pressable onPress={() => handleRename(item.id)}>
                  <Text style={styles.action}>Save</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setRenamingId(item.id);
                    setRenameValue(item.name);
                  }}
                >
                  <Text style={styles.action}>Rename</Text>
                </Pressable>
              )}
              <Pressable onPress={() => confirmDelete(item.id)}>
                <Text style={[styles.action, styles.deleteAction]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  list: { padding: 16 },
  empty: { padding: 40, textAlign: "center", color: "#94a3b8" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  name: { fontSize: 15, color: "#0f172a", flex: 1 },
  input: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 },
  actions: { flexDirection: "row", gap: 14, marginLeft: 12 },
  action: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
  deleteAction: { color: "#e11d48" },
  error: { color: "#e11d48", fontSize: 13, padding: 16 },
});
