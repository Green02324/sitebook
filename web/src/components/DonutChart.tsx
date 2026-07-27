import { useState } from "react";
import { formatCents, formatPercent } from "../lib/money";

export interface DonutExpenseSlice {
  key: string;
  label: string;
  amountCents: number;
  color: string;
}

export interface DonutDetail {
  debits: { name: string; amountCents: number }[];
}

interface DonutChartProps {
  totalIncomeCents: number;
  netCents: number;
  slices: DonutExpenseSlice[];
  loadDetail: (key: string) => Promise<DonutDetail>;
}

const SIZE = 260;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const INNER_STROKE = 18;
const INNER_RADIUS = 68;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;

// The whole circle represents total credits (income). Colored wedges bite
// into it for each debit source (projects + overhead); whatever's left
// uncovered — this light Apple-gray background — IS the profit. There's no
// dedicated "income" wedge to draw.
const LEFTOVER_COLOR = "#c7c7cc";

// Same rotating Apple-system palette used for sub-wedges in the expense
// tracker — distinct from any single project's own outer-ring color.
const SUB_PALETTE = ["#5856d6", "#ff2d55", "#ffcc00", "#5ac8fa", "#4cd964", "#ff9500", "#af52de", "#8e8e93", "#00c7be", "#ff6482", "#a2845e", "#30b0c7"];

export function DonutChart({ totalIncomeCents, netCents, slices, loadDetail }: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<DonutDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const visibleSlices = slices.filter((s) => s.amountCents > 0);
  const totalExpenseCents = visibleSlices.reduce((s, x) => s + x.amountCents, 0);
  // Normally the denominator is total credits (the whole circle = income).
  // If total debits exceed income (a loss), debit wedges would overrun the
  // circle — so the denominator grows to fit them instead, leaving no gray
  // "leftover" showing, which correctly reflects there being no profit.
  const denominator = Math.max(totalIncomeCents, totalExpenseCents, 1);

  let cumulative = 0;
  const expenseSegments = visibleSlices.map((s) => {
    const fraction = s.amountCents / denominator;
    const seg = { ...s, dashArray: `${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`, dashOffset: -cumulative * CIRCUMFERENCE };
    cumulative += fraction;
    return seg;
  });

  async function toggle(key: string) {
    if (activeKey === key) {
      setActiveKey(null);
      setDetail(null);
      return;
    }
    setActiveKey(key);
    setDetail(null);
    setLoading(true);
    try {
      setDetail(await loadDetail(key));
    } finally {
      setLoading(false);
    }
  }

  const activeSlice = visibleSlices.find((s) => s.key === activeKey);
  // Debit-only breakdown — the sub-donut shows what a project/overhead cost,
  // never what it earned.
  const subItems = detail
    ? detail.debits.filter((d) => d.amountCents > 0).map((d, i) => ({ name: d.name, amountCents: d.amountCents, color: SUB_PALETTE[i % SUB_PALETTE.length] }))
    : [];
  const subTotal = subItems.reduce((s, i) => s + i.amountCents, 0);
  const subDenominator = Math.max(subTotal, 1);
  let subCumulative = 0;
  const subSegments = subItems.map((item) => {
    const fraction = item.amountCents / subDenominator;
    const seg = { ...item, dashArray: `${fraction * INNER_CIRCUMFERENCE} ${INNER_CIRCUMFERENCE}`, dashOffset: -subCumulative * INNER_CIRCUMFERENCE };
    subCumulative += fraction;
    return seg;
  });

  const showingDetail = Boolean(activeKey) && !loading && subItems.length > 0;
  const netPct = totalIncomeCents > 0 ? (netCents / totalIncomeCents) * 100 : null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={LEFTOVER_COLOR} strokeWidth={STROKE} />
          {expenseSegments.map((seg) => (
            <circle
              key={seg.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              style={{ cursor: "pointer", transition: "stroke-dasharray 400ms ease, stroke-dashoffset 400ms ease" }}
              onClick={() => toggle(seg.key)}
            />
          ))}
          {showingDetail &&
            subSegments.map((seg, i) => (
              <circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={INNER_RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={INNER_STROKE}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
                style={{ transition: "stroke-dasharray 300ms ease, stroke-dashoffset 300ms ease" }}
              />
            ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          {activeKey ? (
            <>
              <div className="text-xs font-semibold text-slate-500">{activeSlice?.label ?? "Overhead"}</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">{loading ? "…" : formatCents(subTotal)}</div>
              <button
                onClick={() => toggle(activeKey)}
                className="pointer-events-auto mt-1.5 rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-500">Net Profit</div>
              <div className={`text-2xl font-bold tracking-tight ${netCents >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCents(netCents)}</div>
              <div className={`text-sm font-semibold ${netCents >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatPercent(netPct)}</div>
              <div className="text-xs text-slate-500">of {formatCents(totalIncomeCents)} income</div>
            </>
          )}
        </div>
      </div>

      {showingDetail && (
        <div className="flex w-full max-w-xs flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3.5">
          {subSegments.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="font-medium text-slate-900">{formatCents(item.amountCents)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEFTOVER_COLOR }} />
          Total Income · {formatCents(totalIncomeCents)}
        </span>
        {visibleSlices.map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
            style={{ border: activeKey === s.key ? "1.5px solid #1e293b" : "1.5px solid transparent" }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label} · {formatCents(s.amountCents)}
          </button>
        ))}
      </div>
    </div>
  );
}
