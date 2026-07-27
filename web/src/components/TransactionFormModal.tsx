import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { CategorySelect } from "./CategorySelect";
import { centsToInputValue, toCents } from "../lib/money";
import type { Category, Transaction, TransactionMode, TransactionType } from "../types";

interface TransactionFormModalProps {
  mode: TransactionMode;
  categories: Category[];
  initial?: Transaction | null;
  onClose: () => void;
  onSubmit: (data: { type: TransactionType; date: string; amountCents: number; categoryId: string | null; notes: string | null }) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

export function TransactionFormModal({ mode, categories, initial, onClose, onSubmit, onCreateCategory }: TransactionFormModalProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "DEBIT");
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(initial ? centsToInputValue(initial.amountCents) : "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
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
      await onSubmit({ type, date, amountCents, categoryId, notes: notes || null });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit transaction" : `Add ${mode === "ESTIMATE" ? "estimate" : "actual"} entry`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("DEBIT")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${type === "DEBIT" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-600"}`}
          >
            Debit
          </button>
          <button
            type="button"
            onClick={() => setType("CREDIT")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${type === "CREDIT" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-600"}`}
          >
            Credit
          </button>
        </div>

        <label className="text-sm font-medium text-slate-700">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
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
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="0.00"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Category
          <div className="mt-1">
            <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} onCreate={onCreateCategory} />
          </div>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Notes
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
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
