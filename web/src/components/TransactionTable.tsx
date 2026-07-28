import { useEffect, useRef, useState } from "react";
import { centsToInputValue, formatCents, toCents } from "../lib/money";
import type { Category, Transaction } from "../types";

const BULLET_MARKER = /^[-*•]\s*/;

export type InlinePatch = Partial<{
  phase: string | null;
  categoryId: string | null;
  description: string | null;
  amountCents: number;
}>;

// Which cell, if any, is currently open for editing. Keyed by row id and
// field so only one cell is ever live at a time.
type EditingCell = { id: string; field: keyof InlinePatch } | null;

// The first line names the item and anything after it is a sub-task. Leading
// "-" or "*" is stripped so hand-typed markers and plain lines render the
// same way — several existing line items were already written that way.
function DescriptionCell({ description, hasNotes }: { description: string | null; hasNotes: boolean }) {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const heading = lines.length > 0 && !BULLET_MARKER.test(lines[0]) ? lines[0] : null;
  const subTasks = (heading ? lines.slice(1) : lines).map((l) => l.replace(BULLET_MARKER, ""));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1.5">
        {heading ? <span className="text-slate-700">{heading}</span> : lines.length === 0 ? <span className="text-slate-400">—</span> : null}
        {hasNotes && (
          <span
            title="This item has notes — open Edit to read them"
            className="mt-0.5 shrink-0 rounded-sm bg-amber-100 px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-amber-800"
          >
            Note
          </span>
        )}
      </div>
      {subTasks.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {subTasks.map((task, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-500">
              <span aria-hidden className="text-slate-400">
                •
              </span>
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Wraps a read-only cell so clicking it opens the editor. Kept as a button for
// keyboard access — tabbing to a cell and pressing Enter opens it too.
function EditTrigger({ onOpen, children, title }: { onOpen: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className="-mx-1 w-full rounded px-1 text-left hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-300"
    >
      {children}
    </button>
  );
}

interface TransactionTableProps {
  transactions: Transaction[];
  readOnly: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  hideType?: boolean;
  emptyLabel?: string;
  // Supplied only where a hand-set order means something (the estimate), so
  // the actuals ledger keeps its date ordering.
  onMove?: (tx: Transaction, direction: -1 | 1) => void;
  // Estimates are planned by construction phase and carry no date, so the
  // first column shows the phase instead.
  showPhase?: boolean;
  // Enables click-to-edit on the cells. Without it the table stays read-only
  // display and everything goes through the Edit dialog.
  onInlineSave?: (tx: Transaction, patch: InlinePatch) => Promise<void>;
  categories?: Category[];
  phases?: string[];
}

export function TransactionTable({
  transactions,
  readOnly,
  onEdit,
  onDelete,
  hideType,
  emptyLabel,
  onMove,
  showPhase,
  onInlineSave,
  categories = [],
  phases = [],
}: TransactionTableProps) {
  const [editing, setEditing] = useState<EditingCell>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const inlineEnabled = Boolean(onInlineSave) && !readOnly;

  useEffect(() => {
    inputRef.current?.focus();
  }, [editing]);

  function open(tx: Transaction, field: keyof InlinePatch, initial: string) {
    setError(null);
    setDraft(initial);
    setEditing({ id: tx.id, field });
  }

  function isOpen(tx: Transaction, field: keyof InlinePatch) {
    return editing?.id === tx.id && editing.field === field;
  }

  async function commit(tx: Transaction, patch: InlinePatch) {
    setEditing(null);
    setError(null);
    try {
      await onInlineSave!(tx, patch);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function commitDraft(tx: Transaction, field: keyof InlinePatch) {
    const trimmed = draft.trim();
    if (field === "amountCents") {
      let cents: number;
      try {
        cents = trimmed === "" ? 0 : toCents(trimmed);
      } catch {
        setError("Amount must be a number");
        setEditing(null);
        return;
      }
      if (cents === tx.amountCents) return setEditing(null);
      return commit(tx, { amountCents: cents });
    }
    const next = trimmed === "" ? null : draft;
    if ((tx[field as "description"] ?? null) === next) return setEditing(null);
    return commit(tx, { [field]: next } as InlinePatch);
  }

  // Escape abandons the edit; Enter commits, except in the description where
  // it has to stay available for typing the next sub-task.
  function keyHandler(tx: Transaction, field: keyof InlinePatch, multiline = false) {
    return (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setEditing(null);
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commitDraft(tx, field);
      }
    };
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{emptyLabel ?? "No transactions yet."}</div>
    );
  }

  const inputClass = "w-full rounded-md border border-indigo-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400";

  return (
    <div className="flex flex-col gap-2">
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">{showPhase ? "Phase" : "Date"}</th>
              {!hideType && <th className="px-4 py-2">Type</th>}
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Amount</th>
              {!readOnly && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx, i) => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 align-top text-slate-600">
                  {showPhase && inlineEnabled ? (
                    isOpen(tx, "phase") ? (
                      <select
                        ref={inputRef as React.Ref<HTMLSelectElement>}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          commit(tx, { phase: e.target.value || null });
                        }}
                        onBlur={() => setEditing(null)}
                        className={inputClass}
                      >
                        <option value="">No phase</option>
                        {(tx.phase && !phases.includes(tx.phase) ? [tx.phase, ...phases] : phases).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <EditTrigger title="Click to change phase" onOpen={() => open(tx, "phase", tx.phase ?? "")}>
                        {tx.phase ?? <span className="text-slate-400">—</span>}
                      </EditTrigger>
                    )
                  ) : showPhase ? (
                    (tx.phase ?? <span className="text-slate-400">—</span>)
                  ) : tx.date ? (
                    new Date(tx.date).toLocaleDateString()
                  ) : (
                    "—"
                  )}
                </td>
                {!hideType && (
                  <td className="px-4 py-2 align-top">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tx.type === "CREDIT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                    >
                      {tx.type === "CREDIT" ? "Credit" : "Debit"}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2 align-top text-slate-600">
                  {inlineEnabled ? (
                    isOpen(tx, "categoryId") ? (
                      <select
                        ref={inputRef as React.Ref<HTMLSelectElement>}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          commit(tx, { categoryId: e.target.value || null });
                        }}
                        onBlur={() => setEditing(null)}
                        className={inputClass}
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <EditTrigger title="Click to change category" onOpen={() => open(tx, "categoryId", tx.categoryId ?? "")}>
                        {tx.category?.name ?? <span className="text-slate-400">—</span>}
                      </EditTrigger>
                    )
                  ) : (
                    (tx.category?.name ?? "—")
                  )}
                </td>
                <td className="max-w-sm px-4 py-2 align-top text-slate-500">
                  {inlineEnabled ? (
                    isOpen(tx, "description") ? (
                      <textarea
                        ref={inputRef as React.Ref<HTMLTextAreaElement>}
                        value={draft}
                        rows={Math.min(8, Math.max(2, draft.split(/\r?\n/).length + 1))}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitDraft(tx, "description")}
                        onKeyDown={keyHandler(tx, "description", true)}
                        className={inputClass}
                      />
                    ) : (
                      <EditTrigger title="Click to edit description and sub-tasks" onOpen={() => open(tx, "description", tx.description ?? "")}>
                        <DescriptionCell description={tx.description} hasNotes={Boolean(tx.notes && tx.notes.trim())} />
                      </EditTrigger>
                    )
                  ) : (
                    <DescriptionCell description={tx.description} hasNotes={Boolean(tx.notes && tx.notes.trim())} />
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2 text-right align-top font-medium ${tx.type === "CREDIT" ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {inlineEnabled ? (
                    isOpen(tx, "amountCents") ? (
                      <input
                        ref={inputRef as React.Ref<HTMLInputElement>}
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitDraft(tx, "amountCents")}
                        onKeyDown={keyHandler(tx, "amountCents")}
                        className={`${inputClass} text-right`}
                      />
                    ) : (
                      <EditTrigger title="Click to edit amount" onOpen={() => open(tx, "amountCents", centsToInputValue(tx.amountCents))}>
                        <span className="block text-right">{formatCents(tx.amountCents)}</span>
                      </EditTrigger>
                    )
                  ) : (
                    formatCents(tx.amountCents)
                  )}
                </td>
                {!readOnly && (
                  <td className="whitespace-nowrap px-4 py-2 text-right align-top">
                    {onMove && (
                      <span className="mr-3 inline-flex align-middle">
                        <button
                          onClick={() => onMove(tx, -1)}
                          disabled={i === 0}
                          aria-label="Move up"
                          title="Move up"
                          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-25 disabled:hover:bg-transparent"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => onMove(tx, 1)}
                          disabled={i === transactions.length - 1}
                          aria-label="Move down"
                          title="Move down"
                          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-25 disabled:hover:bg-transparent"
                        >
                          ▼
                        </button>
                      </span>
                    )}
                    <button onClick={() => onEdit(tx)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => onDelete(tx)} className="text-xs font-medium text-rose-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
