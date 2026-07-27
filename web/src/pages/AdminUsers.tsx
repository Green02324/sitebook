import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BackLink } from "../components/BackLink";
import type { UserWithProjectCount } from "../types";

export function AdminUsers() {
  const [users, setUsers] = useState<UserWithProjectCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

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
      setTempPassword({ email: res.user.email, password: res.tempPassword });
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
        <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Created <strong>{tempPassword.email}</strong> with temporary password:{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5">{tempPassword.password}</code>
          </span>
          <button onClick={() => setTempPassword(null)} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

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
    </div>
  );
}
