import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useView, withViewParams } from "../../context/ViewContext";
import { TransactionTable } from "../../components/TransactionTable";
import { TransactionFormModal } from "../../components/TransactionFormModal";
import type { ProjectDetailContext } from "../ProjectDetail";
import type { Category, Transaction, TransactionMode, TransactionType } from "../../types";

export function TransactionModeTab({ mode }: { mode: TransactionMode }) {
  const { project, categories, reloadCategories, readOnly } = useOutletContext<ProjectDetailContext>();
  const view = useView();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [project.id, mode, typeFilter, categoryFilter, view.targetUserId, view.readOnly]);

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
