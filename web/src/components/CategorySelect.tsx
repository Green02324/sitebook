import { useState } from "react";
import type { Category } from "../types";

interface CategorySelectProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreate: (name: string) => Promise<Category>;
}

export function CategorySelect({ categories, value, onChange, onCreate }: CategorySelectProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const category = await onCreate(newName.trim());
      onChange(category.id);
      setCreating(false);
      setNewName("");
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    // Plain div, not a <form> — this renders inside TransactionFormModal's
    // own <form>, and nested <form> elements are invalid HTML that browsers
    // handle inconsistently (e.g. mis-submitting the outer form).
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <button type="button" onClick={handleCreate} disabled={saving} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          Add
        </button>
        <button type="button" onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setCreating(true);
        } else {
          onChange(e.target.value || null);
        }
      }}
      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
    >
      <option value="">No category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__new__">+ Create new category…</option>
    </select>
  );
}
