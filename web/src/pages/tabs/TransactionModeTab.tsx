import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useView, withViewParams } from "../../context/ViewContext";
import { TransactionTable } from "../../components/TransactionTable";
import { TransactionFormModal } from "../../components/TransactionFormModal";
import { formatCents, formatPercent, profitPercent, centsToInputValue } from "../../lib/money";
import type { ProjectDetailContext } from "../ProjectDetail";
import type { Category, Transaction, TransactionMode, TransactionType } from "../../types";

function EstimateProfitCalculator({ costCents }: { costCents: number }) {
  const [pctInput, setPctInput] = useState("");
  const [revenueInput, setRevenueInput] = useState("");

  function handlePctChange(value: string) {
    setPctInput(value);
    const pct = Number(value);
    if (value.trim() === "" || !Number.isFinite(pct) || pct >= 100) {
      setRevenueInput("");
      return;
    }
    const revenueCents = costCents / (1 - pct / 100);
    setRevenueInput(centsToInputValue(Math.round(revenueCents)));
  }

  function handleRevenueChange(value: string) {
    setRevenueInput(value);
    const revenue = Number(value);
    if (value.trim() === "" || !Number.isFinite(revenue) || revenue <= 0) {
      setPctInput("");
      return;
    }
    const revenueCents = Math.round(revenue * 100);
    const pct = profitPercent(revenueCents, costCents);
    setPctInput(pct === null ? "" : pct.toFixed(1));
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Profit Calculator</h3>
        <span className="text-xs text-slate-500">Estimated cost: {formatCents(costCents)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        Enter either field and the other updates automatically. This is just a planning tool — add an estimate credit yourself once you've decided what to
        charge.
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
  const [totals, setTotals] = useState({ debitCents: 0, creditCents: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (typeFilter) params.set("type", typeFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    api
      .get<Transaction[]>(withViewParams(`/projects/${project.id}/transactions?${params.toString()}`, view))
      .then(setTransactions)
      .finally(() => setLoading(false));
  }

  // Always unfiltered, independent of the table's type/category filters, so
  // the profit summary reflects the whole mode, not just what's shown below.
  function loadTotals() {
    api
      .get<Transaction[]>(withViewParams(`/projects/${project.id}/transactions?mode=${mode}`, view))
      .then((all) => {
        let debitCents = 0;
        let creditCents = 0;
        for (const tx of all) {
          if (tx.type === "CREDIT") creditCents += tx.amountCents;
          else debitCents += tx.amountCents;
        }
        setTotals({ debitCents, creditCents });
      })
      .catch(() => {});
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [project.id, mode, typeFilter, categoryFilter, view.targetUserId, view.readOnly]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadTotals, [project.id, mode, view.targetUserId, view.readOnly]);

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
    loadTotals();
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm("Delete this transaction?")) return;
    await api.delete(`/projects/${project.id}/transactions/${tx.id}`);
    load();
    loadTotals();
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "ESTIMATE" ? (
        <EstimateProfitCalculator costCents={totals.debitCents} />
      ) : (
        <ActualsProfitLine debitCents={totals.debitCents} creditCents={totals.creditCents} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | "")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <button onClick={() => setEditing("new")} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">
            Add {mode === "ESTIMATE" ? "Estimate" : "Entry"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <TransactionTable transactions={transactions} readOnly={readOnly} onEdit={setEditing} onDelete={handleDelete} />
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
