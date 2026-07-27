import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fetchBlob } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { formatCents, formatPercent } from "../lib/money";
import type { ReportResponse } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

export function ReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const view = useView();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  function reportPath(): string {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString();
    return `/projects/${projectId}/report${qs ? `?${qs}` : ""}`;
  }

  function load() {
    setLoading(true);
    api
      .get<ReportResponse>(withViewParams(reportPath(), view))
      .then(setReport)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [projectId, view.targetUserId, view.readOnly]);

  async function handleView() {
    // Open the tab synchronously, in direct response to the click, so the
    // browser doesn't treat it as a popup once the async fetch resolves.
    const pdfWindow = window.open("", "_blank");
    setOpening(true);
    try {
      const blob = await fetchBlob(withViewParams(reportPath().replace("/report", "/report/pdf"), view));
      const url = URL.createObjectURL(blob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        window.location.href = url;
      }
    } finally {
      setOpening(false);
    }
  }

  if (loading || !report) return <div className="text-sm text-slate-500">Loading…</div>;

  const totalCredits = report.credits.reduce((s, c) => s + c.subtotalCents, 0);
  const totalDebits = report.debits.reduce((s, d) => s + d.subtotalCents, 0);

  const prefix = basePath(view.readOnly, view.targetUserId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`${prefix}/projects/${projectId}`} className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to project
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{report.projectName} — Report</h1>
        <button onClick={handleView} disabled={opening} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {opening ? "Preparing…" : "View PDF"}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <button onClick={load} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Apply
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Credits by Category</h2>
          <div className="flex flex-col divide-y divide-slate-100">
            {report.credits.map((c) => (
              <div key={c.categoryName} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-600">{c.categoryName}</span>
                <span className="font-medium text-emerald-700">{formatCents(c.subtotalCents)}</span>
              </div>
            ))}
            {report.credits.length === 0 && <div className="py-2 text-sm text-slate-400">None</div>}
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="text-emerald-700">{formatCents(totalCredits)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Debits by Category</h2>
          <div className="flex flex-col divide-y divide-slate-100">
            {report.debits.map((d) => (
              <div key={d.categoryName} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-600">{d.categoryName}</span>
                <span className="font-medium text-rose-700">{formatCents(d.subtotalCents)}</span>
              </div>
            ))}
            {report.debits.length === 0 && <div className="py-2 text-sm text-slate-400">None</div>}
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="text-rose-700">{formatCents(totalDebits)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-lg font-bold">
        <div className="flex justify-between">
          <span>Net Profit</span>
          <span className={report.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCents(report.netCents)}</span>
        </div>
        <div className="flex justify-between text-base">
          <span className="font-medium text-slate-600">Profit %</span>
          <span className={report.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatPercent(report.profitPct)}</span>
        </div>
      </div>
    </div>
  );
}
