import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@/api";
import { CategoryPicker } from "@/components/CategoryPicker";
import { centsToInputValue, toCents } from "@/lib/money";
import type { Category, Transaction, TransactionMode, TransactionType } from "@/types";

export default function TransactionModal() {
  const params = useLocalSearchParams<{ projectId: string; mode: TransactionMode; transaction?: string }>();
  const { projectId, mode } = params;
  const initial: Transaction | null = params.transaction ? JSON.parse(params.transaction) : null;
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TransactionType>(initial?.type ?? "DEBIT");
  const [date, setDate] = useState(initial ? new Date(initial.date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState(initial ? centsToInputValue(initial.amountCents) : "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Category[]>(`/projects/${projectId}/categories`).then(setCategories);
  }, [projectId]);

  async function handleCreateCategory(name: string): Promise<Category> {
    const category = await api.post<Category>(`/projects/${projectId}/categories`, { name });
    setCategories((prev) => [...prev, category]);
    return category;
  }

  async function handleSubmit() {
    setError(null);
    let amountCents: number;
    try {
      amountCents = toCents(amount);
      if (amountCents <= 0) throw new Error("Amount must be greater than zero");
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        mode,
        date: date.toISOString().slice(0, 10),
        amountCents,
        categoryId,
        notes: notes || null,
      };
      if (initial) {
        await api.put(`/projects/${projectId}/transactions/${initial.id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/transactions`, payload);
      }
      router.back();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.typeRow}>
        <Pressable style={[styles.typeButton, type === "DEBIT" && styles.typeButtonDebitActive]} onPress={() => setType("DEBIT")}>
          <Text style={[styles.typeButtonText, type === "DEBIT" && styles.typeButtonTextActive]}>Debit</Text>
        </Pressable>
        <Pressable style={[styles.typeButton, type === "CREDIT" && styles.typeButtonCreditActive]} onPress={() => setType("CREDIT")}>
          <Text style={[styles.typeButtonText, type === "CREDIT" && styles.typeButtonTextActive]}>Credit</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateButtonText}>{date.toLocaleDateString()}</Text>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selected) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selected) setDate(selected);
          }}
        />
      )}

      <Text style={styles.label}>Amount</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />

      <Text style={styles.label}>Category</Text>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} onCreate={handleCreateCategory} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} multiline />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 6 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  typeButton: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  typeButtonDebitActive: { backgroundColor: "#ffe4e6", borderColor: "#e11d48" },
  typeButtonCreditActive: { backgroundColor: "#d1fae5", borderColor: "#059669" },
  typeButtonText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  typeButtonTextActive: { color: "#0f172a" },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 10 },
  dateButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  dateButtonText: { fontSize: 14, color: "#0f172a" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  notesInput: { minHeight: 70, textAlignVertical: "top" },
  error: { color: "#e11d48", fontSize: 13, marginTop: 8 },
  saveButton: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
