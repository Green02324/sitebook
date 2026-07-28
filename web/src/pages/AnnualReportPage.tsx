import { useEffect, useState } from "react";
import { api, fetchBlob } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { BackLink } from "../components/BackLink";
import { formatCents, formatPercent } from "../lib/money";
import { OVERHEAD_LABEL } from "../lib/labels";
import type { AnnualDetailedResponse, AnnualLedgerResponse, AnnualSummaryResponse, DetailedTxLine, LedgerLine } from "../types";

type ViewKey = "summary" | "detailed" | "ledger";

function TxTable({ rows }: { rows: DetailedTxLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.type === "CREDIT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {t.type === "CREDIT" ? "Credit" : "Debit"}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-600">{t.categoryName}</td>
              <td className="max-w-xs truncate px-4 py-2 text-slate-500">{t.description ?? ""}</td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${t.type === "CREDIT" ? "text-emerald-700" : "text-rose-700"}`}>
                {formatCents(t.amountCents)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                No transactions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTable({ rows }: { rows: LedgerLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((l, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(l.date).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-slate-600">{l.source}</td>
              <td className="px-4 py-2 text-slate-600">{l.categoryName}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-700">{formatCents(l.amountCents)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryView({ data }: { data: AnnualSummaryResponse }) {
  const totalProjectNet = data.projects.reduce((s, p) => s + p.netCents, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Income</th>
              <th className="px-4 py-2 text-right">Expense</th>
              <th className="px-4 py-2 text-right">Net</th>
              <th className="px-4 py-2 text-right">Profit %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.projects.map((p) => (
              <tr key={p.name}>
                <td className="px-4 py-2 font-medium text-slate-700">{p.name}</td>
                <td className="px-4 py-2 text-slate-600">{p.status}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(p.incomeCents)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatCents(p.expenseCents)}</td>
                <td className={`px-4 py-2 text-right font-medium ${p.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCents(p.netCents)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatPercent(p.profitPct)}</td>
              </tr>
            ))}
            {data.projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No projects with activity this year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-600">Total Project Net</span>
          <span className="font-semibold text-slate-900">{formatCents(totalProjectNet)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-600">{OVERHEAD_LABEL}</span>
          <span className="font-semibold text-rose-700">({formatCents(data.overheadCents)})</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
          <span>Annual Net Profit</span>
          <span className={data.grandNetCents >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCents(data.grandNetCents)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailedView({ data }: { data: AnnualDetailedResponse }) {
  return (
    <div className="flex flex-col gap-6">
      {data.projects.map((p) => (
        <div key={p.name} className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">{p.name}</h2>
          <TxTable rows={p.transactions} />
        </div>
      ))}
      {data.overhead.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">{OVERHEAD_LABEL}</h2>
          <TxTable rows={data.overhead} />
        </div>
      )}
    </div>
  );
}

function LedgerView({ data }: { data: AnnualLedgerResponse }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Credits by Date</h2>
        <LedgerTable rows={data.credits} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Debits by Date</h2>
        <LedgerTable rows={data.debits} />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-600">Total Credits</span>
          <span className="font-semibold text-emerald-700">{formatCents(data.totalCredits)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-600">Total Debits</span>
          <span className="font-semibold text-rose-700">{formatCents(data.totalDebits)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
          <span>Net Profit</span>
          <span className={data.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCents(data.netCents)}</span>
        </div>
      </div>
    </div>
  );
}

export function AnnualReportPage() {
  const view = useView();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeView, setActiveView] = useState<ViewKey>("summary");
  const [summary, setSummary] = useState<AnnualSummaryResponse | null>(null);
  const [detailed, setDetailed] = useState<AnnualDetailedResponse | null>(null);
  const [ledger, setLedger] = useState<AnnualLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setLoading(true);
    const path = `/reports/annual/${activeView}?year=${year}`;
    api
      .get(withViewParams(path, view))
      .then((data) => {
        if (activeView === "summary") setSummary(data as AnnualSummaryResponse);
        else if (activeView === "detailed") setDetailed(data as AnnualDetailedResponse);
        else setLedger(data as AnnualLedgerResponse);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, year, view.targetUserId, view.readOnly]);

  async function handleViewPdf() {
    const pdfWindow = window.open("", "_blank");
    setOpening(true);
    try {
      const blob = await fetchBlob(withViewParams(`/reports/annual/${activeView}/pdf?year=${year}`, view));
      const url = URL.createObjectURL(blob);
      if (pdfWindow) pdfWindow.location.href = url;
      else window.location.href = url;
    } finally {
      setOpening(false);
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const tabClass = (key: ViewKey) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${activeView === key ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to={view.readOnly ? `/admin/users/${view.targetUserId}/dashboard` : "/dashboard"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Annual Report</h1>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button onClick={handleViewPdf} disabled={opening} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {opening ? "Preparing…" : "View PDF"}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveView("summary")} className={tabClass("summary")}>
          Summary
        </button>
        <button onClick={() => setActiveView("detailed")} className={tabClass("detailed")}>
          Detailed
        </button>
        <button onClick={() => setActiveView("ledger")} className={tabClass("ledger")}>
          Ledger
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          {activeView === "summary" && summary && <SummaryView data={summary} />}
          {activeView === "detailed" && detailed && <DetailedView data={detailed} />}
          {activeView === "ledger" && ledger && <LedgerView data={ledger} />}
        </>
      )}
    </div>
  );
}
