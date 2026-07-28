import { useEffect, useState, type FormEvent } from "react";
import { api, fetchBlob } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { Modal } from "../components/Modal";
import { BackLink } from "../components/BackLink";
import { CategorySelect } from "../components/CategorySelect";
import { formatCents, toCents, centsToInputValue } from "../lib/money";
import { OVERHEAD_LABEL, OVERHEAD_LABEL_FULL } from "../lib/labels";
import type { OverheadCategory, OverheadExpense } from "../types";

function OverheadFormModal({
  initial,
  categories,
  onClose,
  onSubmit,
  onCreateCategory,
}: {
  initial: OverheadExpense | null;
  categories: OverheadCategory[];
  onClose: () => void;
  onSubmit: (data: { date: string; amountCents: number; categoryId: string | null; description: string | null; notes: string | null }) => Promise<void>;
  onCreateCategory: (name: string) => Promise<OverheadCategory>;
}) {
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(initial ? centsToInputValue(initial.amountCents) : "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let amountCents: number;
    try {
      amountCents = toCents(amount);
      if (amountCents <= 0) throw new Error("Amount must be greater than zero");
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ date, amountCents, categoryId, description: description || null, notes: notes || null });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit Operating Expense" : "Add Operating Expense"} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-700">
          Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Category
          <div className="mt-1">
            <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} onCreate={onCreateCategory} />
          </div>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OverheadCategoriesModal({ categories, onClose, onChanged }: { categories: OverheadCategory[]; onClose: () => void; onChanged: () => void }) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRename(id: string) {
    setError(null);
    try {
      await api.put(`/overhead/categories/${id}`, { name: renameValue });
      setRenamingId(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.delete(`/overhead/categories/${id}`);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={`Manage ${OVERHEAD_LABEL} Categories`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
            {renamingId === c.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(c.id)}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            ) : (
              <span className="text-sm text-slate-700">{c.name}</span>
            )}
            <div className="flex gap-2 text-xs font-medium">
              {renamingId === c.id ? (
                <button onClick={() => handleRename(c.id)} className="text-indigo-600 hover:underline">
                  Save
                </button>
              ) : (
                <button
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameValue(c.name);
                  }}
                  className="text-indigo-600 hover:underline"
                >
                  Rename
                </button>
              )}
              <button onClick={() => handleDelete(c.id)} className="text-rose-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <div className="text-sm text-slate-500">No categories yet — add one from an expense.</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}

export function OverheadPage() {
  const view = useView();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expenses, setExpenses] = useState<OverheadExpense[]>([]);
  const [categories, setCategories] = useState<OverheadCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OverheadExpense | "new" | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    // Open the tab synchronously, in direct response to the click, so the
    // browser doesn't treat it as a popup once the async fetch resolves.
    const pdfWindow = window.open("", "_blank");
    setPrinting(true);
    try {
      const blob = await fetchBlob(withViewParams(`/overhead/pdf?year=${year}`, view));
      const url = URL.createObjectURL(blob);
      if (pdfWindow) pdfWindow.location.href = url;
      else window.location.href = url;
    } finally {
      setPrinting(false);
    }
  }

  function loadExpenses() {
    setLoading(true);
    api
      .get<OverheadExpense[]>(withViewParams(`/overhead?year=${year}`, view))
      .then(setExpenses)
      .finally(() => setLoading(false));
  }
  function loadCategories() {
    api.get<OverheadCategory[]>(withViewParams("/overhead/categories", view)).then(setCategories);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadExpenses, [year, view.targetUserId, view.readOnly]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadCategories, [view.targetUserId, view.readOnly]);

  async function handleCreateCategory(name: string): Promise<OverheadCategory> {
    const category = await api.post<OverheadCategory>("/overhead/categories", { name });
    loadCategories();
    return category;
  }

  async function handleSubmit(data: { date: string; amountCents: number; categoryId: string | null; description: string | null; notes: string | null }) {
    if (editing && editing !== "new") {
      await api.put(`/overhead/${editing.id}`, data);
    } else {
      await api.post("/overhead", data);
    }
    setEditing(null);
    loadExpenses();
  }

  async function handleDelete(expense: OverheadExpense) {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/overhead/${expense.id}`);
    loadExpenses();
  }

  const totalCents = expenses.reduce((s, e) => s + e.amountCents, 0);
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to={view.readOnly ? `/admin/users/${view.targetUserId}/dashboard` : "/dashboard"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{OVERHEAD_LABEL_FULL}</h1>
        <div className="flex gap-2">
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
          <button
            onClick={handlePrint}
            disabled={printing}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {printing ? "Preparing…" : "Print"}
          </button>
          {!view.readOnly && (
            <>
              <button
                onClick={() => setShowCategories(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Categories
              </button>
              <button onClick={() => setEditing("new")} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">
                Add Expense
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <span className="text-sm font-semibold text-slate-700">Total {OVERHEAD_LABEL} ({year})</span>
        <span className="text-sm font-semibold text-rose-700">{formatCents(totalCents)}</span>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                {!view.readOnly && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-600">{e.category?.name ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-slate-500">{e.description ?? ""}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-rose-700">{formatCents(e.amountCents)}</td>
                  {!view.readOnly && (
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button onClick={() => setEditing(e)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(e)} className="text-xs font-medium text-rose-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No operating expenses for {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <OverheadFormModal
          initial={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
          onCreateCategory={handleCreateCategory}
        />
      )}
      {showCategories && <OverheadCategoriesModal categories={categories} onClose={() => setShowCategories(false)} onChanged={loadCategories} />}
    </div>
  );
}
