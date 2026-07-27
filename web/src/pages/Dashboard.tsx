import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { DonutChart, type DonutDetail, type DonutExpenseSlice } from "../components/DonutChart";
import { YearSelector } from "../components/YearSelector";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { formatCents } from "../lib/money";
import type { DashboardBreakdown, DashboardResponse } from "../types";

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
    { key: OVERHEAD_KEY, label: "Overhead", amountCents: data.overheadCents, color: OVERHEAD_COLOR },
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
    </div>
  );
}
