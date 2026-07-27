import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { Modal } from "../components/Modal";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import type { Project, ProjectStatus } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

export function ProjectsList() {
  const view = useView();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<Project[]>(withViewParams("/projects", view))
      .then(setProjects)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [view.targetUserId, view.readOnly]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/projects", { name, description: description || undefined, status });
      setShowCreate(false);
      setName("");
      setDescription("");
      setStatus("PLANNING");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const prefix = basePath(view.readOnly, view.targetUserId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        {!view.readOnly && (
          <button onClick={() => setShowCreate(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            New Project
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`${prefix}/projects/${p.id}`}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </div>
              {p.description && <p className="line-clamp-2 text-sm text-slate-500">{p.description}</p>}
              <span className="text-xs text-slate-400">{p._count?.transactions ?? 0} transactions</span>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No projects yet.
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <Modal title="New Project" onClose={() => setShowCreate(false)}>
          <form className="flex flex-col gap-3" onSubmit={handleCreate}>
            <label className="text-sm font-medium text-slate-700">
              Name
              <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
