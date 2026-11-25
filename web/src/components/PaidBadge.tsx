import type { PaidStatus } from "../types";

const STYLES: Record<PaidStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  UNPAID: "bg-slate-100 text-slate-600",
};

const LABELS: Record<PaidStatus, string> = { PAID: "Paid", PARTIAL: "Part paid", UNPAID: "Unpaid" };

export function PaidBadge({ status }: { status: PaidStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{LABELS[status]}</span>;
}
