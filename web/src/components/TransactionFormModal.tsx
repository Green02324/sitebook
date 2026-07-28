import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { CategorySelect } from "./CategorySelect";
import { PhaseSelect } from "./PhaseSelect";
import { centsToInputValue, toCents } from "../lib/money";
import type { Category, Transaction, TransactionMode, TransactionType } from "../types";

export interface TransactionFormPayload {
  type: TransactionType;
  date: string | null;
  phase: string | null;
  amountCents: number;
  categoryId: string | null;
  notes: string | null;
}

interface TransactionFormModalProps {
  mode: TransactionMode;
  categories: Category[];
  phases: string[];
  initial?: Transaction | null;
  onClose: () => void;
  onSubmit: (data: TransactionFormPayload) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

export function TransactionFormModal({ mode, categories, phases, initial, onClose, onSubmit, onCreateCategory }: TransactionFormModalProps) {
  const isEstimate = mode === "ESTIMATE";
  const [type, setType] = useState<TransactionType>(initial?.type ?? "DEBIT");
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [phase, setPhase] = useState<string | null>(initial?.phase ?? null);
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
      // Estimates may be left at zero — the scope gets laid out first and
      // priced once the order of operations is settled.
      amountCents = amount.trim() === "" && isEstimate ? 0 : toCents(amount);
      if (amountCents < 0) throw new Error("Amount cannot be negative");
      if (!isEstimate && amountCents <= 0) throw new Error("Amount must be greater than zero");
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        type,
        date: isEstimate ? null : date,
        phase: isEstimate ? phase : null,
        amountCents,
        categoryId,
        notes: notes || null,
      });
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

        {isEstimate ? (
          <label className="text-sm font-medium text-slate-700">
            Phase
            <div className="mt-1">
              <PhaseSelect phases={phases} value={phase} onChange={setPhase} />
            </div>
          </label>
        ) : (
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
        )}

        <label className="text-sm font-medium text-slate-700">
          Amount
          <input
            type="number"
            step="0.01"
            min={isEstimate ? "0" : "0.01"}
            required={!isEstimate}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="0.00"
          />
          {isEstimate && <span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to price it later.</span>}
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
