import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { DonutChart } from "../components/DonutChart";
import { YearSelector } from "../components/YearSelector";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { formatCents } from "../lib/money";
import type { DashboardResponse } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

export function Dashboard() {
  const view = useView();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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

  const selectedProject = data.projects.find((p) => p.id === selectedProjectId);
  const prefix = basePath(view.readOnly, view.targetUserId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <YearSelector years={data.availableYears} value={data.year} onChange={setYear} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <DonutChart
          outer={[
            { name: "Income", value: data.totalIncomeCents },
            { name: "Expenses", value: data.totalExpenseCents },
          ]}
          inner={
            selectedProject
              ? [
                  { name: "Income", value: selectedProject.incomeCents },
                  { name: "Expenses", value: selectedProject.expenseCents },
                ]
              : undefined
          }
          centerLabel={selectedProject ? selectedProject.name : "All projects"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Projects</h2>
        <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {data.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId((cur) => (cur === p.id ? null : p.id))}
              className={`flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 ${selectedProjectId === p.id ? "bg-indigo-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold ${p.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCents(p.netCents)}</span>
                <Link
                  to={`${prefix}/projects/${p.id}`}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open →
                </Link>
              </div>
            </button>
          ))}
          {data.projects.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No projects yet.</div>}
        </div>
      </div>
    </div>
  );
}
