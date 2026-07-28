import { formatCents } from "../lib/money";
import type { Transaction } from "../types";

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
}

export function TransactionTable({ transactions, readOnly, onEdit, onDelete, hideType, emptyLabel, onMove }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{emptyLabel ?? "No transactions yet."}</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            {!hideType && <th className="px-4 py-2">Type</th>}
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Notes</th>
            <th className="px-4 py-2 text-right">Amount</th>
            {!readOnly && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((tx, i) => (
            <tr key={tx.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(tx.date).toLocaleDateString()}</td>
              {!hideType && (
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tx.type === "CREDIT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                  >
                    {tx.type === "CREDIT" ? "Credit" : "Debit"}
                  </span>
                </td>
              )}
              <td className="px-4 py-2 text-slate-600">{tx.category?.name ?? "—"}</td>
              <td className="max-w-xs truncate px-4 py-2 text-slate-500">{tx.notes ?? ""}</td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${tx.type === "CREDIT" ? "text-emerald-700" : "text-rose-700"}`}>
                {formatCents(tx.amountCents)}
              </td>
              {!readOnly && (
                <td className="whitespace-nowrap px-4 py-2 text-right">
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
  );
}
