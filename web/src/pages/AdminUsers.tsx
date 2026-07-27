import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BackLink } from "../components/BackLink";
import { Modal } from "../components/Modal";
import type { User, UserWithProjectCount } from "../types";

// Shown once, right after the password is generated. There is no way to look
// an existing password up again later — they're only ever stored as hashes.
interface IssuedCredential {
  email: string;
  password: string;
  kind: "created" | "reset";
}

interface StorageInfo {
  capacityBytes: number;
  usedBytes: number;
  breakdown: { label: string; bytes: number; color: string }[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function StorageCard() {
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  useEffect(() => {
    api
      .get<StorageInfo>("/users/storage")
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  if (!storage) return null;

  const { capacityBytes, usedBytes, breakdown } = storage;
  const nonZero = breakdown.filter((b) => b.bytes > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Storage</h2>
      <p className="mb-4 text-sm text-slate-500">
        {formatBytes(usedBytes)} of {formatBytes(capacityBytes)} used
      </p>

      <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-200">
        {nonZero.map((b) => (
          // Real usage is a rounding error against the capacity, so floor each
          // nonzero segment at a visible sliver rather than nothing at all.
          <div key={b.label} style={{ width: `${Math.max((b.bytes / capacityBytes) * 100, 0.8)}%`, background: b.color }} />
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">
        {breakdown.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
            {b.label}
            <span className="text-slate-500">{formatBytes(b.bytes)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserWithProjectCount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.put<User>(`/users/${user.id}`, { name, email });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-700">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

export function AdminUsers() {
  const [users, setUsers] = useState<UserWithProjectCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<IssuedCredential | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithProjectCount | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<UserWithProjectCount[]>("/users")
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.post<{ user: UserWithProjectCount; tempPassword: string }>("/users", { name, email });
      setTempPassword({ email: res.user.email, password: res.tempPassword, kind: "created" });
      setShowCreate(false);
      setName("");
      setEmail("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(user: UserWithProjectCount) {
    if (!confirm(`Reset the password for ${user.name}? Their current password stops working immediately and they'll be signed out everywhere.`)) return;
    setError(null);
    setResettingId(user.id);
    try {
      const res = await api.post<{ email: string; tempPassword: string }>(`/users/${user.id}/reset-password`);
      setTempPassword({ email: res.email, password: res.tempPassword, kind: "reset" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/dashboard" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin — Users</h1>
        <button onClick={() => setShowCreate((s) => !s)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          New User
        </button>
      </div>

      {tempPassword && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-1">
            <span>
              {tempPassword.kind === "created" ? "Created" : "Reset password for"} <strong>{tempPassword.email}</strong>. Temporary password:{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5">{tempPassword.password}</code>
            </span>
            <span className="text-xs text-amber-800">Copy it now — it is hashed on save and can't be shown again.</span>
          </div>
          <button onClick={() => setTempPassword(null)} className="shrink-0 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {error && !showCreate && <div className="text-sm text-rose-600">{error}</div>}

      {showCreate && (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4" onSubmit={handleCreate}>
          <label className="text-sm font-medium text-slate-700">
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          </label>
          <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create"}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Projects</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2 text-slate-600">{u.role}</td>
                  <td className="px-4 py-2 text-slate-600">{u.projectCount}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button onClick={() => setEditingUser(u)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => handleResetPassword(u)}
                      disabled={resettingId === u.id}
                      className="mr-3 text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                    >
                      {resettingId === u.id ? "Resetting…" : "Reset password"}
                    </button>
                    <Link to={`/admin/users/${u.id}/dashboard`} className="text-xs font-medium text-indigo-600 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StorageCard />

      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={load} />}
    </div>
  );
}
