import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

export function DonutChart({ outer, inner, centerLabel }: DonutChartProps) {
  const hasInner = Boolean(inner && inner.some((d) => d.value > 0));

  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={outer} dataKey="value" nameKey="name" innerRadius={80} outerRadius={110} paddingAngle={2}>
            {outer.map((_, i) => (
              <Cell key={i} fill={OUTER_COLORS[i % OUTER_COLORS.length]} />
            ))}
          </Pie>
          {hasInner && inner && (
            <Pie data={inner} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {inner.map((_, i) => (
                <Cell key={i} fill={INNER_COLORS[i % INNER_COLORS.length]} />
              ))}
            </Pie>
          )}
          <Tooltip formatter={(value: number) => formatCents(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
          <span className="text-xs font-medium text-slate-500">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
