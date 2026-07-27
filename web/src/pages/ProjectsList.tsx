import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { Modal } from "../components/Modal";
import { ProjectForm, type ProjectFormPayload } from "../components/ProjectForm";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { BackLink } from "../components/BackLink";
import { SORT_OPTIONS, sortProjects, type SortKey } from "../lib/sortProjects";
import type { Project } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

export function ProjectsList() {
  const view = useView();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const sortedProjects = useMemo(() => sortProjects(projects, sortKey), [projects, sortKey]);

  function load() {
    setLoading(true);
    api
      .get<Project[]>(withViewParams("/projects", view))
      .then(setProjects)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [view.targetUserId, view.readOnly]);

  async function handleCreate(payload: ProjectFormPayload) {
    await api.post("/projects", payload);
    setShowCreate(false);
    load();
  }

  async function handleEdit(payload: ProjectFormPayload) {
    if (!editingProject) return;
    await api.put(`/projects/${editingProject.id}`, payload);
    setEditingProject(null);
    load();
  }

  const prefix = basePath(view.readOnly, view.targetUserId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to={`${prefix}/dashboard`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="project-sort" className="text-sm font-medium text-slate-600">
            Sort by
          </label>
          <select
            id="project-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {!view.readOnly && (
            <button onClick={() => setShowCreate(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              New Project
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((p) => (
            <Link
              key={p.id}
              to={`${prefix}/projects/${p.id}`}
              className="relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <div className="flex items-center gap-2">
                  <ProjectStatusBadge status={p.status} />
                  {!view.readOnly && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingProject(p);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {p.description && <p className="line-clamp-2 text-sm text-slate-500">{p.description}</p>}
              {p.clientName && <span className="text-xs text-slate-500">Client: {p.clientName}</span>}
              {p.address && <span className="text-xs text-slate-500">{p.address}</span>}
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
        <Modal title="New Project" onClose={() => setShowCreate(false)} wide>
          <ProjectForm submitLabel="Create" onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />
        </Modal>
      )}

      {editingProject && (
        <Modal title="Edit Project" onClose={() => setEditingProject(null)} wide>
          <ProjectForm initial={editingProject} submitLabel="Save" onCancel={() => setEditingProject(null)} onSubmit={handleEdit} />
        </Modal>
      )}
    </div>
  );
}
