import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { api } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { Modal } from "../components/Modal";
import type { Category, Project } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

export interface ProjectDetailContext {
  project: Project;
  categories: Category[];
  reloadCategories: () => void;
  readOnly: boolean;
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const view = useView();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  function loadCategories() {
    api.get<Category[]>(withViewParams(`/projects/${projectId}/categories`, view)).then(setCategories);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Project>(withViewParams(`/projects/${projectId}`, view)),
      api.get<Category[]>(withViewParams(`/projects/${projectId}/categories`, view)),
    ])
      .then(([p, c]) => {
        setProject(p);
        setCategories(c);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, view.targetUserId, view.readOnly]);

  if (loading || !project) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  const prefix = basePath(view.readOnly, view.targetUserId);
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 px-1 pb-2 text-sm font-medium ${isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`;

  const outletContext: ProjectDetailContext = { project, categories, reloadCategories: loadCategories, readOnly: view.readOnly };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && <p className="mt-1 text-sm text-slate-500">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <NavLink
            to={`${prefix}/projects/${projectId}/report`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Report
          </NavLink>
          {!view.readOnly && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Categories
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200">
        <NavLink to="estimate" className={tabClass}>
          Estimate
        </NavLink>
        <NavLink to="actuals" className={tabClass}>
          Actuals
        </NavLink>
        <NavLink to="comparison" className={tabClass}>
          Comparison
        </NavLink>
      </div>

      <Outlet context={outletContext} />

      {showSettings && (
        <CategorySettingsModal project={project} categories={categories} onClose={() => setShowSettings(false)} onChanged={loadCategories} />
      )}
    </div>
  );
}

function CategorySettingsModal({
  project,
  categories,
  onClose,
  onChanged,
}: {
  project: Project;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRename(id: string) {
    setError(null);
    try {
      await api.put(`/projects/${project.id}/categories/${id}`, { name: renameValue });
      setRenamingId(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.delete(`/projects/${project.id}/categories/${id}`);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title="Manage Categories" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
            {renamingId === c.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(c.id)}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            ) : (
              <span className="text-sm text-slate-700">{c.name}</span>
            )}
            <div className="flex gap-2 text-xs font-medium">
              {renamingId === c.id ? (
                <button onClick={() => handleRename(c.id)} className="text-indigo-600 hover:underline">
                  Save
                </button>
              ) : (
                <button
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameValue(c.name);
                  }}
                  className="text-indigo-600 hover:underline"
                >
                  Rename
                </button>
              )}
              <button onClick={() => handleDelete(c.id)} className="text-rose-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <div className="text-sm text-slate-500">No categories yet — add one from a transaction.</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}
