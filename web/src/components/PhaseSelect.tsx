import { useState } from "react";

interface PhaseSelectProps {
  phases: string[];
  value: string | null;
  onChange: (phase: string | null) => void;
}

// Phases are plain strings on the line item rather than their own records, so
// "adding" one is just typing it — it shows up in this list from then on
// because the project reports back the distinct phases it has used.
export function PhaseSelect({ phases, value, onChange }: PhaseSelectProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  function commit() {
    const name = newName.trim();
    if (!name) return;
    onChange(name);
    setCreating(false);
    setNewName("");
  }

  if (creating) {
    // Plain div, not a <form> — this renders inside the transaction modal's
    // own <form>, and nested forms are invalid HTML.
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="e.g. Site work, Frame, Mids, Finish"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" onClick={commit} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
          Add
        </button>
        <button type="button" onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    );
  }

  // A phase already on this line item might not be in the project's list yet
  // (it's saved but the list was fetched earlier), so make sure it's offered.
  const options = value && !phases.includes(value) ? [value, ...phases] : phases;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new__") setCreating(true);
        else onChange(e.target.value || null);
      }}
      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
    >
      <option value="">No phase</option>
      {options.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value="__new__">+ Add new phase…</option>
    </select>
  );
}
