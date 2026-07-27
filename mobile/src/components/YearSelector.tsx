import { ScrollView, Text, Pressable, StyleSheet } from "react-native";

interface YearSelectorProps {
  years: number[];
  value: number;
  onChange: (year: number) => void;
}

export function YearSelector({ years, value, onChange }: YearSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {years.map((y) => {
        const active = y === value;
        return (
          <Pressable key={y} style={[styles.pill, active && styles.pillActive]} onPress={() => onChange(y)}>
            <Text style={[styles.text, active && styles.textActive]}>{y}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 0 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#e2e8f0", marginLeft: 8 },
  pillActive: { backgroundColor: "#4f46e5" },
  text: { fontSize: 13, fontWeight: "600", color: "#475569" },
  textActive: { color: "#ffffff" },
});
