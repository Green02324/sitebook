import { View, Text, Pressable, StyleSheet } from "react-native";
import { formatCents } from "../lib/money";
import type { Transaction } from "../types";

interface TransactionListItemProps {
  transaction: Transaction;
  onPress: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export function TransactionListItem({ transaction, onPress, onDelete, readOnly }: TransactionListItemProps) {
  const isCredit = transaction.type === "CREDIT";
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.left}>
        <Text style={styles.date}>{new Date(transaction.date).toLocaleDateString()}</Text>
        <Text style={styles.category}>{transaction.category?.name ?? "Uncategorized"}</Text>
        {transaction.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {transaction.notes}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]}>{formatCents(transaction.amountCents)}</Text>
        {!readOnly && (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  left: { flex: 1, marginRight: 12 },
  date: { fontSize: 12, color: "#94a3b8" },
  category: { fontSize: 14, fontWeight: "600", color: "#0f172a", marginTop: 2 },
  notes: { fontSize: 12, color: "#64748b", marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 15, fontWeight: "700" },
  credit: { color: "#059669" },
  debit: { color: "#e11d48" },
  deleteText: { fontSize: 11, color: "#e11d48", fontWeight: "600" },
});
