import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { BackLink } from "../components/BackLink";
import { EngagementModal, LogHoursModal, type EngagementFormData, type LogHoursData } from "../components/ConsultingModals";
import { formatCents } from "../lib/money";
import { formatDay, formatHours } from "../lib/consulting";
import { HOURS_LABEL } from "../lib/labels";
import { useAuth } from "../context/AuthContext";
import type { ConsultingEngagementDetail, ConsultingEngagementHeadline } from "../types";

export function ConsultingPage() {
  const view = useView();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState<ConsultingEngagementHeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<string | "any" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const prefix = view.readOnly ? `/admin/users/${view.targetUserId}` : "";

  function load() {
    api
      .get<ConsultingEngagementHeadline[]>(withViewParams("/consulting/engagements", view))
      .then(setEngagements)
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [view.targetUserId, view.readOnly]);

  async function handleCreate(data: EngagementFormData) {
    const created = await api.post<ConsultingEngagementDetail>("/consulting/engagements", data);
    navigate(`/consulting/${created.id}`);
  }

  async function handleLog(data: LogHoursData) {
    await api.post(`/consulting/engagements/${data.engagementId}/entries`, {
      date: data.date,
      hours: data.hours,
      summary: data.summary,
    });
    load();
  }

  const active = engagements.filter((e) => !e.archivedAt);
  const archived = engagements.filter((e) => e.archivedAt);
  const totalOwed = active.reduce((s, e) => s + e.balanceCents, 0);
  const totalUnpaidMinutes = active.reduce((s, e) => s + e.unpaidMinutes, 0);

  function Card({ e }: { e: ConsultingEngagementHeadline }) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Link to={`${prefix}/consulting/${e.id}`} className="block">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{e.name}</div>
              {e.clientName && <div className="truncate text-sm text-slate-500">{e.clientName}</div>}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{formatHours(e.unpaidMinutes)}</div>
              <div className="text-xs text-slate-500">unpaid</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Logged</div>
              <div className="font-medium text-slate-800">{formatHours(e.totalMinutes)}</div>
            </div>
            <div>
              <div className="text-slate-500">Billed</div>
              <div className="font-medium text-slate-800">{e.effectiveRateCents ? formatCents(e.billableCents) : "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Owed</div>
              <div className={`font-semibold ${e.balanceCents > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {e.effectiveRateCents ? formatCents(e.balanceCents) : "—"}
              </div>
            </div>
          </div>
          {e.lastEntryDate && <div className="mt-2 text-xs text-slate-400">Last entry {formatDay(e.lastEntryDate)}</div>}
        </Link>
        {!view.readOnly && !e.archivedAt && (
          <button onClick={() => setLogging(e.id)} className="mt-3 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            Log hours
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to={`${prefix}/dashboard`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{HOURS_LABEL}</h1>
        {!view.readOnly && (
          <button onClick={() => setCreating(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            New engagement
          </button>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <span className="text-sm font-semibold text-slate-700">Unpaid across all engagements</span>
          <span className="text-right">
            <span className="block text-sm font-semibold text-amber-700">{formatCents(totalOwed)}</span>
            <span className="block text-xs text-slate-500">{formatHours(totalUnpaidMinutes)}</span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((e) => (
              <Card key={e.id} e={e} />
            ))}
          </div>
          {active.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No consulting engagements yet.
              {!view.readOnly && " Start one to begin logging hours."}
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <button onClick={() => setShowArchived((s) => !s)} className="text-sm font-medium text-slate-600 hover:underline">
                {showArchived ? "▾" : "▸"} Archived ({archived.length})
              </button>
              {showArchived && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {archived.map((e) => (
                    <Card key={e.id} e={e} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {creating && (
        <EngagementModal initial={null} defaultRateCents={user?.consultingRateCents ?? null} onClose={() => setCreating(false)} onSubmit={handleCreate} />
      )}
      {logging && (
        <LogHoursModal
          engagements={active.map((e) => ({ id: e.id, name: e.name }))}
          initialEngagementId={logging === "any" ? undefined : logging}
          onClose={() => setLogging(null)}
          onSubmit={handleLog}
        />
      )}
    </div>
  );
}
