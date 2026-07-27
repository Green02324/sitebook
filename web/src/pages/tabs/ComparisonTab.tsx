import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useView, withViewParams } from "../../context/ViewContext";
import { formatCents } from "../../lib/money";
import type { ProjectDetailContext } from "../ProjectDetail";
import type { ComparisonRow } from "../../types";

function ComparisonBar({ label, debitCents, creditCents, maxCents }: { label: string; debitCents: number; creditCents: number; maxCents: number }) {
  const total = debitCents + creditCents;
  const profit = creditCents - debitCents;
  const barWidthPct = maxCents > 0 ? (total / maxCents) * 100 : 0;
  const debitPct = total > 0 ? (debitCents / total) * 100 : 0;
  const creditPct = total > 0 ? (creditCents / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-medium ${profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCents(profit)} profit</span>
      </div>
      <div className="h-5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full rounded-full" style={{ width: `${barWidthPct}%` }}>
          {debitCents > 0 && <div className="h-full bg-rose-400" style={{ width: `${debitPct}%` }} />}
          {creditCents > 0 && <div className="h-full bg-emerald-400" style={{ width: `${creditPct}%` }} />}
        </div>
      </div>
    </div>
  );
}

export function ComparisonTab() {
  const { project } = useOutletContext<ProjectDetailContext>();
  const view = useView();
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<ComparisonRow[]>(withViewParams(`/projects/${project.id}/comparison`, view))
      .then(setRows)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, view.targetUserId, view.readOnly]);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  function varianceClass(v: number): string {
    if (v > 0) return "text-rose-700";
    if (v < 0) return "text-emerald-700";
    return "text-slate-500";
  }

  const totalEstimateDebit = rows.reduce((s, r) => s + r.estimateDebitCents, 0);
  const totalEstimateCredit = rows.reduce((s, r) => s + r.estimateCreditCents, 0);
  const totalActualDebit = rows.reduce((s, r) => s + r.actualDebitCents, 0);
  const totalActualCredit = rows.reduce((s, r) => s + r.actualCreditCents, 0);
  const maxTotal = Math.max(totalEstimateDebit + totalEstimateCredit, totalActualDebit + totalActualCredit, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <ComparisonBar label="Estimate" debitCents={totalEstimateDebit} creditCents={totalEstimateCredit} maxCents={maxTotal} />
        <ComparisonBar label="Actual" debitCents={totalActualDebit} creditCents={totalActualCredit} maxCents={maxTotal} />
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            Debits
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Credits
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Est. Debit</th>
              <th className="px-4 py-2 text-right">Act. Debit</th>
              <th className="px-4 py-2 text-right">Variance</th>
              <th className="px-4 py-2 text-right">Est. Credit</th>
              <th className="px-4 py-2 text-right">Act. Credit</th>
              <th className="px-4 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.categoryId ?? "uncategorized"}>
                <td className="px-4 py-2 font-medium text-slate-700">{r.categoryName}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(r.estimateDebitCents)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(r.actualDebitCents)}</td>
                <td className={`px-4 py-2 text-right font-medium ${varianceClass(r.varianceDebitCents)}`}>{formatCents(r.varianceDebitCents)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(r.estimateCreditCents)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(r.actualCreditCents)}</td>
                <td className={`px-4 py-2 text-right font-medium ${varianceClass(-r.varianceCreditCents)}`}>{formatCents(r.varianceCreditCents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
