import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { DonutChart, type DonutDetail, type DonutExpenseSlice } from "../components/DonutChart";
import { YearSelector } from "../components/YearSelector";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { formatCents } from "../lib/money";
import { HOURS_LABEL, OVERHEAD_LABEL } from "../lib/labels";
import { formatHours } from "../lib/consulting";
import type { ConsultingEngagementHeadline, DashboardBreakdown, DashboardResponse } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

const OVERHEAD_KEY = "__OVERHEAD__";
const OVERHEAD_COLOR = "#8e8e93";
// Apple-system palette, rotated per project (income/overhead colors reserved above).
const PROJECT_PALETTE = ["#0a84ff", "#af52de", "#ff9500", "#ff2d55", "#5856d6", "#ffcc00", "#5ac8fa", "#ff3b30", "#4cd964", "#00c7be", "#a2845e", "#30b0c7"];

export function Dashboard() {
  const view = useView();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<ConsultingEngagementHeadline[]>([]);

  // Consulting hours are not tied to a year or to any project figures, so they
  // load on their own and never touch the donut or the profit totals.
  useEffect(() => {
    api
      .get<ConsultingEngagementHeadline[]>(withViewParams("/consulting/engagements", view))
      .then(setEngagements)
      .catch(() => setEngagements([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.targetUserId, view.readOnly]);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardResponse>(withViewParams(`/dashboard?year=${year}`, view))
      .then((res) => {
        setData(res);
        setYear(res.year);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, view.targetUserId, view.readOnly]);

  if (loading || !data) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  const prefix = basePath(view.readOnly, view.targetUserId);

  const slices: DonutExpenseSlice[] = [
    ...data.projects.map((p, i) => ({ key: p.id, label: p.name, amountCents: p.expenseCents, color: PROJECT_PALETTE[i % PROJECT_PALETTE.length] })),
    { key: OVERHEAD_KEY, label: OVERHEAD_LABEL, amountCents: data.overheadCents, color: OVERHEAD_COLOR },
  ];
  const netCents = data.totalIncomeCents - data.totalExpenseCents - data.overheadCents;

  async function loadDetail(key: string): Promise<DonutDetail> {
    const params = new URLSearchParams({ year: String(year) });
    if (key === OVERHEAD_KEY) params.set("overhead", "true");
    else params.set("projectId", key);
    const res = await api.get<DashboardBreakdown>(withViewParams(`/dashboard/breakdown?${params.toString()}`, view));
    return res;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <YearSelector years={data.availableYears} value={data.year} onChange={setYear} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <DonutChart totalIncomeCents={data.totalIncomeCents} netCents={netCents} slices={slices} loadDetail={loadDetail} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Projects</h2>
        <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {data.projects.map((p) => (
            <Link
              key={p.id}
              to={`${prefix}/projects/${p.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </div>
              <span className={`text-sm font-semibold ${p.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCents(p.netCents)}</span>
            </Link>
          ))}
          {data.projects.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No projects yet.</div>}
        </div>
      </div>

      {(engagements.some((e) => !e.archivedAt) || !view.readOnly) && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{HOURS_LABEL}</h2>
            <Link to={`${prefix}/consulting`} className="text-sm font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {engagements
              .filter((e) => !e.archivedAt)
              .map((e) => (
                <Link key={e.id} to={`${prefix}/consulting/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">{formatHours(e.unpaidMinutes)} unpaid</div>
                  </div>
                  <span className={`text-sm font-semibold ${e.balanceCents > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {e.effectiveRateCents || e.billableCents > 0 ? formatCents(e.balanceCents) : "—"}
                  </span>
                </Link>
              ))}
            {engagements.filter((e) => !e.archivedAt).length === 0 && (
              <Link to={`${prefix}/consulting`} className="px-4 py-6 text-center text-sm text-slate-500 hover:bg-slate-50">
                No consulting engagements yet — tap to start tracking hours.
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
