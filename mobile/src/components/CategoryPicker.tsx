import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, FlatList, StyleSheet } from "react-native";
import type { Category } from "../types";

interface CategoryPickerProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreate: (name: string) => Promise<Category>;
}

export function CategoryPicker({ categories, value, onChange, onCreate }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = categories.find((c) => c.id === value);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const category = await onCreate(newName.trim());
      onChange(category.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setOpen(false);
    setCreating(false);
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{selected?.name ?? "No category"}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              style={styles.list}
              ListHeaderComponent={
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(null);
                    close();
                  }}
                >
                  <Text style={styles.optionText}>No category</Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.id);
                    close();
                  }}
                >
                  <Text style={styles.optionText}>{item.name}</Text>
                </Pressable>
              )}
            />
            {creating ? (
              <View style={styles.createRow}>
                <TextInput
                  style={styles.input}
                  placeholder="New category name"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <Pressable style={styles.addButton} onPress={handleCreate} disabled={saving}>
                  <Text style={styles.addButtonText}>{saving ? "Adding…" : "Add"}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.newCategoryButton} onPress={() => setCreating(true)}>
                <Text style={styles.newCategoryText}>+ Create new category</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  triggerText: { fontSize: 14, color: "#0f172a" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "70%" },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#0f172a" },
  list: { flexGrow: 0 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  optionText: { fontSize: 15, color: "#0f172a" },
  createRow: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addButton: { backgroundColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  newCategoryButton: { marginTop: 12, paddingVertical: 10 },
  newCategoryText: { color: "#4f46e5", fontWeight: "600", fontSize: 14 },
});
