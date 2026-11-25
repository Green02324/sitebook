import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { centsToInputValue, formatCents, toCents } from "../lib/money";
import { hoursValue, todayLocal } from "../lib/consulting";
import type { ConsultingBill, ConsultingEntry } from "../types";

const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:py-1.5 sm:text-sm";
const labelClass = "text-sm font-medium text-slate-700";

function FormButtons({ onClose, saving, saveLabel = "Save" }: { onClose: () => void; saving: boolean; saveLabel?: string }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 sm:py-1.5">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:py-1.5">
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface EngagementFormData {
  name: string;
  clientName: string | null;
  clientEmail: string | null;
  rateCents: number | null;
  notes: string | null;
}

export function EngagementModal({
  initial,
  defaultRateCents,
  onClose,
  onSubmit,
}: {
  initial: { name: string; clientName: string | null; clientEmail: string | null; rateCents: number | null; notes: string | null } | null;
  defaultRateCents: number | null;
  onClose: () => void;
  onSubmit: (data: EngagementFormData) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [rate, setRate] = useState(initial?.rateCents != null ? centsToInputValue(initial.rateCents) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let rateCents: number | null = null;
    if (rate.trim() !== "") {
      try {
        rateCents = toCents(rate);
        if (rateCents <= 0) throw new Error("Rate must be greater than zero");
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        clientName: clientName.trim() || null,
        clientEmail: clientEmail.trim() || null,
        rateCents,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit Engagement" : "New Engagement"} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className={labelClass}>
          Project / engagement name
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Smith Remodel – consulting" />
        </label>
        <label className={labelClass}>
          Client
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Client email (for sending bills)
          <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Hourly rate
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={inputClass}
            placeholder={defaultRateCents != null ? `Default: ${formatCents(defaultRateCents)}/hr` : "Optional"}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Leave blank to use your default rate{defaultRateCents == null ? " (none set — hours are tracked without a dollar amount)" : ""}.
          </span>
        </label>
        <label className={labelClass}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <FormButtons onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export interface LogHoursData {
  engagementId: string;
  date: string;
  hours: number;
  summary: string | null;
  billId?: string;
}

export function LogHoursModal({
  engagements,
  initialEngagementId,
  entry,
  bills,
  onClose,
  onSubmit,
}: {
  engagements: { id: string; name: string }[];
  initialEngagementId?: string;
  // Present when editing an existing entry.
  entry?: ConsultingEntry;
  // Offered as a "Bill" picker when editing, so hours can be moved between bills.
  bills?: ConsultingBill[];
  onClose: () => void;
  onSubmit: (data: LogHoursData) => Promise<void>;
}) {
  const [engagementId, setEngagementId] = useState(initialEngagementId ?? engagements[0]?.id ?? "");
  const [date, setDate] = useState(entry?.date ?? todayLocal());
  const [hours, setHours] = useState(entry ? String(hoursValue(entry.minutes)) : "");
  const [summary, setSummary] = useState(entry?.summary ?? "");
  const [billId, setBillId] = useState(entry?.billId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      setError("Enter hours between 0 and 24 (quarter hours like 1.25 are fine).");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ engagementId, date, hours: h, summary: summary.trim() || null, billId: entry ? billId : undefined });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={entry ? "Edit Hours" : "Log Hours"} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {!entry && engagements.length > 1 && (
          <label className={labelClass}>
            Engagement
            <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} className={inputClass}>
              {engagements.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Date
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Hours
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0.25"
              max="24"
              required
              autoFocus
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
              placeholder="e.g. 2.5"
            />
          </label>
        </div>
        <label className={labelClass}>
          What did you work on?
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className={inputClass} placeholder="Summary of the work done" />
        </label>
        {entry && bills && bills.length > 1 && (
          <label className={labelClass}>
            Bill
            <select value={billId} onChange={(e) => setBillId(e.target.value)} className={inputClass}>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  Bill {b.number}
                  {b.closed ? " (sent)" : " (open)"}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <FormButtons onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export interface PaymentFormData {
  date: string;
  amountCents: number;
  note: string | null;
  closeBill: boolean;
}

export function PaymentModal({
  initial,
  balanceCents,
  canCloseBill,
  onClose,
  onSubmit,
}: {
  // Present when editing; the "close bill" option only applies to new payments.
  initial?: { date: string; amountCents: number; note: string | null };
  balanceCents: number;
  canCloseBill: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentFormData) => Promise<void>;
}) {
  const [date, setDate] = useState(initial?.date ?? todayLocal());
  const [amount, setAmount] = useState(initial ? centsToInputValue(initial.amountCents) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [closeBill, setCloseBill] = useState(true);
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
      await onSubmit({ date, amountCents, note: note.trim() || null, closeBill });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit Payment" : "Record Payment"} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {!initial && <div className="text-sm text-slate-600">Currently owed: <strong>{formatCents(balanceCents)}</strong></div>}
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Date received
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Amount
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </label>
        </div>
        <label className={labelClass}>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. Check #1042" />
        </label>
        {!initial && canCloseBill && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={closeBill} onChange={(e) => setCloseBill(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Close the current bill — hours logged after this go on the next bill.
            </span>
          </label>
        )}
        <div className="text-xs text-slate-500">Payments are applied to your oldest unpaid hours first, so one check can cover several bills.</div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <FormButtons onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}
