import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useView, withViewParams } from "../../context/ViewContext";
import { TransactionTable } from "../../components/TransactionTable";
import { TransactionFormModal } from "../../components/TransactionFormModal";
import { formatCents, formatPercent, profitPercent, centsToInputValue } from "../../lib/money";
import type { ProjectDetailContext } from "../ProjectDetail";
import type { Category, Transaction, TransactionMode, TransactionType } from "../../types";

// The three fields are one relationship seen from three sides:
//   price = cost + profit$        profit% = profit$ / price
// Editing any one field solves for the other two, so a contractor can work
// from whichever number they actually have in mind — "I want 20% on this",
// "I need to clear $8k", or "I'm quoting $40k, what does that leave me?".
// The percentage is margin on price, matching how profitPercent reports
// actuals everywhere else in the app.
function EstimateProfitCalculator({ costCents }: { costCents: number }) {
  const [pctInput, setPctInput] = useState("");
  const [profitInput, setProfitInput] = useState("");
  const [revenueInput, setRevenueInput] = useState("");

  function handlePctChange(value: string) {
    setPctInput(value);
    const pct = Number(value);
    // At 100% margin the price would have to be infinite; above it, negative.
    if (value.trim() === "" || !Number.isFinite(pct) || pct >= 100) {
      setProfitInput("");
      setRevenueInput("");
      return;
    }
    const revenueCents = Math.round(costCents / (1 - pct / 100));
    setRevenueInput(centsToInputValue(revenueCents));
    setProfitInput(centsToInputValue(revenueCents - costCents));
  }

  // A negative target is allowed here — it just means quoting below cost, and
  // the resulting negative percentage says so plainly.
  function handleProfitChange(value: string) {
    setProfitInput(value);
    const profit = Number(value);
    if (value.trim() === "" || !Number.isFinite(profit)) {
      setPctInput("");
      setRevenueInput("");
      return;
    }
    const revenueCents = costCents + Math.round(profit * 100);
    setRevenueInput(centsToInputValue(revenueCents));
    const pct = profitPercent(revenueCents, costCents);
    setPctInput(pct === null ? "" : pct.toFixed(1));
  }

  function handleRevenueChange(value: string) {
    setRevenueInput(value);
    const revenue = Number(value);
    if (value.trim() === "" || !Number.isFinite(revenue) || revenue <= 0) {
      setPctInput("");
      setProfitInput("");
      return;
    }
    const revenueCents = Math.round(revenue * 100);
    setProfitInput(centsToInputValue(revenueCents - costCents));
    const pct = profitPercent(revenueCents, costCents);
    setPctInput(pct === null ? "" : pct.toFixed(1));
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Profit Calculator</h3>
        <span className="text-xs text-slate-500">Estimated cost: {formatCents(costCents)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Target Profit %
          <input
            type="number"
            step="0.1"
            value={pctInput}
            onChange={(e) => handlePctChange(e.target.value)}
            placeholder="e.g. 20"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Target Profit $
          <input
            type="number"
            step="0.01"
            value={profitInput}
            onChange={(e) => handleProfitChange(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Suggested Price
          <input
            type="number"
            step="0.01"
            value={revenueInput}
            onChange={(e) => handleRevenueChange(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Fill in any one field and the other two update automatically. This is just a planning tool — add an estimate credit yourself once you've decided what
        to charge.
      </p>
    </div>
  );
}

function ActualsProfitLine({ debitCents, creditCents }: { debitCents: number; creditCents: number }) {
  const net = creditCents - debitCents;
  const pct = profitPercent(creditCents, debitCents);
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-sm font-medium text-slate-700">Current Profit</span>
      <span className={`text-sm font-semibold ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
        {formatCents(net)} ({formatPercent(pct)})
      </span>
    </div>
  );
}

export function TransactionModeTab({ mode }: { mode: TransactionMode }) {
  const { project, categories, reloadCategories, readOnly } = useOutletContext<ProjectDetailContext>();
  const view = useView();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (categoryFilter) params.set("categoryId", categoryFilter);
    api
      .get<Transaction[]>(withViewParams(`/projects/${project.id}/transactions?${params.toString()}`, view))
      .then(setTransactions)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [project.id, mode, categoryFilter, view.targetUserId, view.readOnly]);

  const debitTransactions = transactions.filter((t) => t.type === "DEBIT");
  const creditTransactions = transactions.filter((t) => t.type === "CREDIT");
  const totals = {
    debitCents: debitTransactions.reduce((s, t) => s + t.amountCents, 0),
    creditCents: creditTransactions.reduce((s, t) => s + t.amountCents, 0),
  };

  async function handleCreateCategory(name: string): Promise<Category> {
    const category = await api.post<Category>(`/projects/${project.id}/categories`, { name });
    reloadCategories();
    return category;
  }

  async function handleSubmit(data: { type: TransactionType; date: string; amountCents: number; categoryId: string | null; notes: string | null }) {
    if (editing && editing !== "new") {
      await api.put(`/projects/${project.id}/transactions/${editing.id}`, { ...data, mode });
    } else {
      await api.post(`/projects/${project.id}/transactions`, { ...data, mode });
    }
    setEditing(null);
    load();
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm("Delete this transaction?")) return;
    await api.delete(`/projects/${project.id}/transactions/${tx.id}`);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "ESTIMATE" ? (
        <EstimateProfitCalculator costCents={totals.debitCents} />
      ) : (
        <ActualsProfitLine debitCents={totals.debitCents} creditCents={totals.creditCents} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {!readOnly && (
          <button onClick={() => setEditing("new")} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">
            Add {mode === "ESTIMATE" ? "Line Item" : "Entry"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Debits</h3>
            <TransactionTable transactions={debitTransactions} readOnly={readOnly} onEdit={setEditing} onDelete={handleDelete} hideType emptyLabel="No debits yet." />
            <div className="flex justify-between px-1 text-sm font-semibold text-rose-700">
              <span>Total Debits</span>
              <span>{formatCents(totals.debitCents)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Credits</h3>
            <TransactionTable transactions={creditTransactions} readOnly={readOnly} onEdit={setEditing} onDelete={handleDelete} hideType emptyLabel="No credits yet." />
            <div className="flex justify-between px-1 text-sm font-semibold text-emerald-700">
              <span>Total Credits</span>
              <span>{formatCents(totals.creditCents)}</span>
            </div>
          </div>
        </>
      )}

      {editing && (
        <TransactionFormModal
          mode={mode}
          categories={categories}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </div>
  );
}
