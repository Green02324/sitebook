import { View, Text, StyleSheet, Platform } from "react-native";
import { PolarChart, Pie } from "victory-native";
import { formatCents } from "../lib/money";

interface DonutSlice {
  name: string;
  value: number;
}

interface DonutChartProps {
  outer: DonutSlice[];
  inner?: DonutSlice[];
  centerLabel?: string;
}

const OUTER_COLORS = ["#4f46e5", "#f43f5e"];
const INNER_COLORS = ["#818cf8", "#fb7185"];

function withColors(data: DonutSlice[], colors: string[]) {
  return data.map((d, i) => ({ ...d, color: colors[i % colors.length] }));
}

const SIZE = 220;
const INNER_SIZE = 130;

export function DonutChart({ outer, inner, centerLabel }: DonutChartProps) {
  const hasInner = Boolean(inner && inner.some((d) => d.value > 0));
  const outerData = withColors(outer, OUTER_COLORS);
  const innerData = hasInner ? withColors(inner!, INNER_COLORS) : [];

  // Skia's web (CanvasKit) rendering path isn't set up for this app, and
  // isn't worth chasing since the real target is iOS/Android — show a plain
  // text summary on web so browser-based smoke testing doesn't crash here.
  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        {outerData.map((d) => (
          <Text key={d.name} style={styles.webFallbackRow}>
            {d.name}: {formatCents(d.value)}
          </Text>
        ))}
        {hasInner &&
          innerData.map((d) => (
            <Text key={`inner-${d.name}`} style={styles.webFallbackRowInner}>
              {centerLabel} — {d.name}: {formatCents(d.value)}
            </Text>
          ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <PolarChart data={outerData} labelKey="name" valueKey="value" colorKey="color">
          <Pie.Chart innerRadius="60%" />
        </PolarChart>
      </View>
      {hasInner && (
        <View style={styles.innerChart}>
          <PolarChart data={innerData} labelKey="name" valueKey="value" colorKey="color">
            <Pie.Chart innerRadius="55%" />
          </PolarChart>
        </View>
      )}
      <View style={styles.centerLabelContainer} pointerEvents="none">
        {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SIZE, height: SIZE, alignSelf: "center" },
  innerChart: {
    position: "absolute",
    top: (SIZE - INNER_SIZE) / 2,
    left: (SIZE - INNER_SIZE) / 2,
    width: INNER_SIZE,
    height: INNER_SIZE,
  },
  centerLabelContainer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  centerLabel: { fontSize: 12, color: "#64748b", fontWeight: "600", textAlign: "center", paddingHorizontal: 12 },
  webFallback: { padding: 16, gap: 4, alignSelf: "stretch" },
  webFallbackRow: { fontSize: 14, color: "#334155", fontWeight: "600" },
  webFallbackRowInner: { fontSize: 13, color: "#64748b" },
});
