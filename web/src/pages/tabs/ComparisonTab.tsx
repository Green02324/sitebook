import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useView, withViewParams } from "../../context/ViewContext";
import { formatCents } from "../../lib/money";
import type { ProjectDetailContext } from "../ProjectDetail";
import type { ComparisonRow } from "../../types";

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

  return (
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
  );
}
