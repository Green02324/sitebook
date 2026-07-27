import { useState, type FormEvent } from "react";
import { centsToInputValue, toCents } from "../lib/money";
import type { Project, ProjectStatus } from "../types";

export interface ProjectFormPayload {
  name: string;
  description?: string;
  status: ProjectStatus;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  address: string | null;
  startDate: string | null;
  targetCompletionDate: string | null;
  contractAmountCents: number | null;
}

interface ProjectFormProps {
  initial?: Project | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (payload: ProjectFormPayload) => Promise<void>;
}

export function ProjectForm({ initial, submitLabel, onCancel, onSubmit }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "PLANNING");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [targetCompletionDate, setTargetCompletionDate] = useState(initial?.targetCompletionDate?.slice(0, 10) ?? "");
  const [contractAmount, setContractAmount] = useState(initial?.contractAmountCents != null ? centsToInputValue(initial.contractAmountCents) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let contractAmountCents: number | null = null;
    if (contractAmount.trim()) {
      try {
        contractAmountCents = toCents(contractAmount);
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    setSaving(true);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        status,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        address: address || null,
        startDate: startDate || null,
        targetCompletionDate: targetCompletionDate || null,
        contractAmountCents,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";
  const labelClass = "text-sm font-medium text-slate-700";

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3">
        <label className={labelClass}>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </label>
        <label className={labelClass}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputClass}>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Client &amp; Contract</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Client Name
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Client Phone
            <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Client Email
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Project Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Start Date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Target Completion
            <input type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Contract / Bid Amount
            <input type="number" step="0.01" min="0" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} placeholder="0.00" className={inputClass} />
          </label>
        </div>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
