import { formatCents } from "../lib/money";
import type { Transaction } from "../types";

interface TransactionTableProps {
  transactions: Transaction[];
  readOnly: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionTable({ transactions, readOnly, onEdit, onDelete }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No transactions yet.</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Notes</th>
            <th className="px-4 py-2 text-right">Amount</th>
            {!readOnly && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(tx.date).toLocaleDateString()}</td>
              <td className="px-4 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tx.type === "CREDIT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                >
                  {tx.type === "CREDIT" ? "Credit" : "Debit"}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-600">{tx.category?.name ?? "—"}</td>
              <td className="max-w-xs truncate px-4 py-2 text-slate-500">{tx.notes ?? ""}</td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${tx.type === "CREDIT" ? "text-emerald-700" : "text-rose-700"}`}>
                {formatCents(tx.amountCents)}
              </td>
              {!readOnly && (
                <td className="whitespace-nowrap px-4 py-2 text-right">
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
