import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, fetchBlob } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { BackLink } from "../components/BackLink";
import { PaidBadge } from "../components/PaidBadge";
import {
  EngagementModal,
  ExpenseModal,
  LogHoursModal,
  PaymentModal,
  type EngagementFormData,
  type ExpenseFormData,
  type LogHoursData,
  type PaymentFormData,
} from "../components/ConsultingModals";
import { formatCents } from "../lib/money";
import { expenseLabel, formatDay, formatHours, slugify } from "../lib/consulting";
import type { ConsultingBill, ConsultingEngagementDetail, ConsultingEntry, ConsultingExpense, ConsultingPayment } from "../types";

const smallBtn = "rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-base font-semibold ${tone ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export function ConsultingDetailPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const view = useView();
  const navigate = useNavigate();
  const [data, setData] = useState<ConsultingEngagementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ConsultingEntry | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ConsultingExpense | null>(null);
  const [paying, setPaying] = useState(false);
  // Set while recording a reimbursement started from an expense row.
  const [reimbursing, setReimbursing] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<ConsultingPayment | null>(null);
  const [editingEngagement, setEditingEngagement] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const base = `/consulting/engagements/${engagementId}`;
  const prefix = view.readOnly ? `/admin/users/${view.targetUserId}` : "";

  function load() {
    api
      .get<ConsultingEngagementDetail>(withViewParams(base, view))
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [engagementId, view.targetUserId, view.readOnly]);

  // Every write returns the refreshed engagement, so the screen just swaps it in.
  async function mutate<T extends ConsultingEngagementDetail | void>(fn: () => Promise<T>) {
    setActionError(null);
    try {
      const result = await fn();
      if (result) setData(result as ConsultingEngagementDetail);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;

  const s = data.summary;
  const rate = data.effectiveRateCents;
  const bills = [...s.bills].sort((a, b) => b.number - a.number);
  const hasCharges = (b: ConsultingBill) => b.entries.length > 0 || b.expenses.length > 0;
  const hasOpenCharges = s.bills.some((b) => !b.closed && hasCharges(b));
  const allExpenses = bills.flatMap((b) => b.expenses);
  // Dollar figures are meaningful with a rate, or once there are expenses.
  const showMoney = !!rate || s.billableCents > 0;

  function pdfPath(billId?: string) {
    return withViewParams(`${base}/pdf${billId ? `?billId=${billId}` : ""}`, view);
  }

  function pdfName(bill?: ConsultingBill) {
    return `${slugify(data!.name)}-${bill ? `bill-${bill.number}` : "time-log"}.pdf`;
  }

  async function openPdf(bill?: ConsultingBill) {
    // Open the tab straight from the tap so the browser doesn't treat it as a popup.
    const pdfWindow = window.open("", "_blank");
    setBusy(bill?.id ?? "all");
    try {
      const blob = await fetchBlob(pdfPath(bill?.id));
      const url = URL.createObjectURL(blob);
      if (pdfWindow) pdfWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      pdfWindow?.close();
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // The phone's share sheet lets Dan send the PDF straight to Mail, Messages,
  // Drive, etc. Where the browser can't share files, fall back to just opening it.
  async function sharePdf(bill?: ConsultingBill) {
    setBusy(bill?.id ?? "all");
    setActionError(null);
    try {
      const blob = await fetchBlob(pdfPath(bill?.id));
      const file = new File([blob], pdfName(bill), { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${data!.name}${bill ? ` – Bill ${bill.number}` : ""}` });
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return; // user closed the sheet
        }
      }
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function emailLink(bill?: ConsultingBill): string {
    const subject = `${data!.name} – ${bill ? `Bill ${bill.number}` : "Time log"}`;
    const minutes = bill ? bill.minutes : s.totalMinutes;
    const amount = bill ? bill.amountCents : s.billableCents;
    const lines = [
      `Hello${data!.clientName ? ` ${data!.clientName}` : ""},`,
      "",
      `${bill ? `Bill ${bill.number}` : "My time log"} for ${data!.name}: ${formatHours(minutes)}${amount > 0 ? ` — ${formatCents(amount)} total` : ""}.`,
      "",
      "(Please see the attached PDF for the detail.)",
    ];
    return `mailto:${data!.clientEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function ExportButtons({ bill }: { bill?: ConsultingBill }) {
    const id = bill?.id ?? "all";
    return (
      <div className="flex flex-wrap gap-2">
        <button className={smallBtn} disabled={busy === id} onClick={() => openPdf(bill)}>
          {busy === id ? "Preparing…" : "View PDF"}
        </button>
        {canShareFiles && (
          <button className={smallBtn} disabled={busy === id} onClick={() => sharePdf(bill)}>
            Share
          </button>
        )}
        <a className={smallBtn} href={emailLink(bill)}>
          Email
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink to={`${prefix}/consulting`} label="Hours Tracking" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
          <div className="text-sm text-slate-500">
            {data.clientName && <span>{data.clientName} · </span>}
            {rate ? `${formatCents(rate)}/hr${data.rateCents == null ? " (default rate)" : ""}` : "No hourly rate set"}
            {data.archivedAt && " · Archived"}
          </div>
        </div>
        {!view.readOnly && (
          <div className="flex gap-2">
            <button className={smallBtn} onClick={() => setEditingEngagement(true)}>
              Edit
            </button>
            <button onClick={() => setAddingExpense(true)} className={smallBtn}>
              Add expense
            </button>
            <button onClick={() => setLogging(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              Log hours
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Unpaid hours" value={formatHours(s.unpaidMinutes)} tone="text-amber-700" />
        <Stat label="Balance due" value={showMoney ? formatCents(s.balanceCents) : "—"} tone={s.balanceCents > 0 ? "text-amber-700" : "text-emerald-700"} />
        <Stat label="Total hours" value={formatHours(s.totalMinutes)} />
        <Stat label="Total billable" value={showMoney ? formatCents(s.billableCents) : "—"} />
        {s.expenseCents > 0 && <Stat label="Expenses (in total)" value={formatCents(s.expenseCents)} />}
        <Stat label="Paid so far" value={formatCents(s.paidCents)} tone="text-emerald-700" />
        {s.creditCents > 0 && <Stat label="Credit (overpaid)" value={formatCents(s.creditCents)} tone="text-emerald-700" />}
      </div>

      {s.unratedMinutes > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {formatHours(s.unratedMinutes)} have no hourly rate, so no dollar amount yet.
          {!view.readOnly && " Set a rate on this engagement (Edit) or a default rate in Profile."}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Bills</h2>
        <ExportButtons />
      </div>

      {bills.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Nothing logged yet.
        </div>
      )}

      {bills.map((b) => (
        <div key={b.id} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Bill {b.number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.closed ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
                {b.closed ? "Sent" : "Open"}
              </span>
              {hasCharges(b) && <PaidBadge status={b.status} />}
            </div>
            <div className="text-right text-sm">
              <span className="font-semibold text-slate-900">{formatHours(b.minutes)}</span>
              {(rate || b.amountCents > 0) && <span className="text-slate-500"> · {formatCents(b.amountCents)}</span>}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {b.entries.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">{formatDay(e.date)}</span>
                  <span className="text-sm text-slate-700">
                    {formatHours(e.minutes)}
                    {e.rateCents != null && <span className="text-slate-500"> · {formatCents(e.amountCents)}</span>}
                  </span>
                </div>
                {e.summary && <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{e.summary}</div>}
                <div className="mt-1 flex items-center justify-between">
                  {e.status !== "UNPAID" ? <PaidBadge status={e.status} /> : <span />}
                  {!view.readOnly && (
                    <span className="flex gap-3 text-xs font-medium">
                      <button onClick={() => setEditingEntry(e)} className="text-indigo-600 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this entry?")) mutate(() => api.delete<ConsultingEngagementDetail>(`${base}/entries/${e.id}`));
                        }}
                        className="text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {b.expenses.map((x) => (
              <div key={x.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">
                    {formatDay(x.date)}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{x.category}</span>
                  </span>
                  <span className="text-sm text-slate-700">{formatCents(x.amountCents)}</span>
                </div>
                {x.description && <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{x.description}</div>}
                {data.payments
                  .filter((p) => p.expenseId === x.id)
                  .map((p) => (
                    <div key={p.id} className="mt-1 text-xs font-medium text-emerald-700">
                      Reimbursed {formatCents(p.amountCents)} on {formatDay(p.date)}
                      {p.note && ` · ${p.note}`}
                    </div>
                  ))}
                {!view.readOnly && x.reimbursedCents < x.amountCents && (
                  <button onClick={() => setReimbursing(x.id)} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                    Add reimbursement
                  </button>
                )}
                <div className="mt-1 flex items-center justify-between">
                  {x.status !== "UNPAID" ? <PaidBadge status={x.status} /> : <span />}
                  {!view.readOnly && (
                    <span className="flex gap-3 text-xs font-medium">
                      <button onClick={() => setEditingExpense(x)} className="text-indigo-600 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this expense?")) mutate(() => api.delete<ConsultingEngagementDetail>(`${base}/expenses/${x.id}`));
                        }}
                        className="text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!hasCharges(b) && <div className="px-4 py-3 text-sm text-slate-500">Nothing on this bill.</div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            {hasCharges(b) ? <ExportButtons bill={b} /> : <span />}
            {!view.readOnly && (
              <div className="flex gap-2">
                {!hasCharges(b) && (
                  <button
                    className={smallBtn}
                    onClick={() => mutate(() => api.delete<ConsultingEngagementDetail>(`${base}/bills/${b.id}`))}
                  >
                    Remove bill
                  </button>
                )}
                {hasCharges(b) && (
                  <button
                    className={smallBtn}
                    onClick={() => mutate(() => api.put<ConsultingEngagementDetail>(`${base}/bills/${b.id}`, { closed: !b.closed }))}
                  >
                    {b.closed ? "Reopen bill" : "Mark as sent"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
        {!view.readOnly && (
          <button onClick={() => setPaying(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Record payment
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {data.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">{formatDay(p.date)}</div>
              {allExpenses
                .filter((x) => x.id === p.expenseId)
                .map((x) => (
                  <div key={x.id} className="truncate text-xs font-medium text-slate-600">
                    Reimbursement: {expenseLabel(x)}
                  </div>
                ))}
              {p.note && <div className="truncate text-xs text-slate-500">{p.note}</div>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-emerald-700">{formatCents(p.amountCents)}</span>
              {!view.readOnly && (
                <span className="flex gap-3 text-xs font-medium">
                  <button onClick={() => setEditingPayment(p)} className="text-indigo-600 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this payment?")) mutate(() => api.delete<ConsultingEngagementDetail>(`${base}/payments/${p.id}`));
                    }}
                    className="text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
        {data.payments.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No payments recorded yet.</div>}
      </div>

      {logging && (
        <LogHoursModal
          engagements={[{ id: data.id, name: data.name }]}
          initialEngagementId={data.id}
          onClose={() => setLogging(false)}
          onSubmit={async (d: LogHoursData) => {
            const next = await api.post<ConsultingEngagementDetail>(`${base}/entries`, { date: d.date, hours: d.hours, summary: d.summary });
            setData(next);
          }}
        />
      )}
      {editingEntry && (
        <LogHoursModal
          engagements={[{ id: data.id, name: data.name }]}
          initialEngagementId={data.id}
          entry={editingEntry}
          bills={bills}
          onClose={() => setEditingEntry(null)}
          onSubmit={async (d: LogHoursData) => {
            const next = await api.put<ConsultingEngagementDetail>(`${base}/entries/${editingEntry.id}`, {
              date: d.date,
              hours: d.hours,
              summary: d.summary,
              billId: d.billId,
            });
            setData(next);
          }}
        />
      )}
      {addingExpense && (
        <ExpenseModal
          engagementId={data.id}
          onClose={() => setAddingExpense(false)}
          onSubmit={async (d: ExpenseFormData) => {
            const next = await api.post<ConsultingEngagementDetail>(`${base}/expenses`, {
              date: d.date,
              amountCents: d.amountCents,
              category: d.category,
              description: d.description,
            });
            setData(next);
          }}
        />
      )}
      {editingExpense && (
        <ExpenseModal
          engagementId={data.id}
          expense={editingExpense}
          bills={bills}
          onClose={() => setEditingExpense(null)}
          onSubmit={async (d: ExpenseFormData) => {
            const next = await api.put<ConsultingEngagementDetail>(`${base}/expenses/${editingExpense.id}`, {
              date: d.date,
              amountCents: d.amountCents,
              category: d.category,
              description: d.description,
              billId: d.billId,
            });
            setData(next);
          }}
        />
      )}
      {(paying || reimbursing) && (
        <PaymentModal
          expenses={allExpenses}
          initialExpenseId={reimbursing ?? undefined}
          balanceCents={s.balanceCents}
          canCloseBill={hasOpenCharges}
          onClose={() => {
            setPaying(false);
            setReimbursing(null);
          }}
          onSubmit={async (d: PaymentFormData) => {
            const next = await api.post<ConsultingEngagementDetail>(`${base}/payments`, d);
            setData(next);
          }}
        />
      )}
      {editingPayment && (
        <PaymentModal
          initial={editingPayment}
          expenses={allExpenses}
          balanceCents={s.balanceCents}
          canCloseBill={false}
          onClose={() => setEditingPayment(null)}
          onSubmit={async (d: PaymentFormData) => {
            const next = await api.put<ConsultingEngagementDetail>(`${base}/payments/${editingPayment.id}`, {
              date: d.date,
              amountCents: d.amountCents,
              note: d.note,
              expenseId: d.expenseId,
            });
            setData(next);
          }}
        />
      )}
      {editingEngagement && (
        <>
          <EngagementModal
            initial={data}
            defaultRateCents={data.defaultRateCents}
            onClose={() => setEditingEngagement(false)}
            onSubmit={async (d: EngagementFormData) => {
              const next = await api.put<ConsultingEngagementDetail>(base, d);
              setData(next);
            }}
          />
        </>
      )}

      {!view.readOnly && (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4 text-sm">
          <button
            className="font-medium text-slate-600 hover:underline"
            onClick={() => mutate(() => api.put<ConsultingEngagementDetail>(base, { archived: !data.archivedAt }))}
          >
            {data.archivedAt ? "Unarchive engagement" : "Archive engagement"}
          </button>
          <button
            className="font-medium text-rose-600 hover:underline"
            onClick={async () => {
              if (!confirm(`Delete "${data.name}" and ALL of its hours, expenses, bills and payments? This cannot be undone.`)) return;
              await api.delete(base);
              navigate("/consulting");
            }}
          >
            Delete engagement
          </button>
        </div>
      )}
    </div>
  );
}
