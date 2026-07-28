import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, fetchBlob } from "../api";
import { useView, withViewParams } from "../context/ViewContext";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { Modal } from "../components/Modal";
import { ProjectForm, type ProjectFormPayload } from "../components/ProjectForm";
import { BackLink } from "../components/BackLink";
import { formatCents } from "../lib/money";
import { mapsUrl } from "../lib/maps";
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
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Which child tab is showing, read from the URL rather than tracked in
  // state so a direct link or a back/forward step stays in sync.
  const activeTab: "estimate" | "actuals" | "comparison" = location.pathname.endsWith("/actuals")
    ? "actuals"
    : location.pathname.endsWith("/comparison")
      ? "comparison"
      : "estimate";
  const [loading, setLoading] = useState(true);

  function loadCategories() {
    api.get<Category[]>(withViewParams(`/projects/${projectId}/categories`, view)).then(setCategories);
  }

  async function handleEdit(payload: ProjectFormPayload) {
    const updated = await api.put<Project>(`/projects/${projectId}`, payload);
    setProject(updated);
    setShowEdit(false);
  }

  // The header button follows whichever tab is open: the actuals report is a
  // page of its own, while estimate and comparison print straight to PDF.
  async function handlePrint() {
    // Open the tab synchronously, in direct response to the click, so the
    // browser doesn't treat it as a popup once the async fetch resolves.
    const pdfWindow = window.open("", "_blank");
    setPrinting(true);
    try {
      const blob = await fetchBlob(withViewParams(`/projects/${projectId}/${activeTab}/pdf`, view));
      const url = URL.createObjectURL(blob);
      if (pdfWindow) pdfWindow.location.href = url;
      else window.location.href = url;
    } finally {
      setPrinting(false);
    }
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
      <div>
        <BackLink to={`${prefix}/projects`} label="Back to Projects" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && <p className="mt-1 text-sm text-slate-500">{project.description}</p>}
          <ProjectInfoLine project={project} />
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "actuals" ? (
            <NavLink
              to={`${prefix}/projects/${projectId}/report`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Report
            </NavLink>
          ) : (
            <button
              onClick={handlePrint}
              disabled={printing}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {printing ? "Preparing…" : activeTab === "comparison" ? "Print Comparison" : "Print Estimate"}
            </button>
          )}
          {!view.readOnly && (
            <button
              onClick={() => setShowEdit(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          {!view.readOnly && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Categories
            </button>
          )}
          {!view.readOnly && (
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200">
        <NavLink to="estimate" className={tabClass}>
          Estimator
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

      {showEdit && (
        <Modal title="Edit Project" onClose={() => setShowEdit(false)} wide>
          <ProjectForm initial={project} submitLabel="Save" onCancel={() => setShowEdit(false)} onSubmit={handleEdit} />
        </Modal>
      )}

      {showDelete && <DeleteProjectModal project={project} onClose={() => setShowDelete(false)} onDeleted={() => navigate(`${prefix}/projects`)} />}
    </div>
  );
}

// startDate/targetCompletionDate are date-only columns, so they arrive as UTC
// midnight. Formatting them in local time renders the previous day for anyone
// west of UTC, so pin the display back to UTC.
function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" });
}

function ProjectInfoLine({ project }: { project: Project }) {
  const hasClient = Boolean(project.clientName || project.clientPhone || project.clientEmail || project.address);
  const hasTerms = Boolean(project.startDate || project.targetCompletionDate || project.contractAmountCents != null);

  if (!hasClient && !hasTerms) return null;

  // Two columns side by side on anything wider than a phone; stacked below
  // that, so neither column wraps mid-item on a narrow screen. Bottom-aligned
  // once side by side — the terms column is shorter, and hanging it off the
  // top left it floating against the taller client block.
  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-12">
      {hasClient && (
        <div className="flex flex-col gap-0.5">
          {project.clientName && <span className="text-base font-bold text-slate-900">{project.clientName}</span>}
          {project.clientPhone && <span className="text-sm font-bold text-slate-700">{project.clientPhone}</span>}
          {project.clientEmail && <span className="text-xs text-slate-500">{project.clientEmail}</span>}
          {project.address && (
            <a
              href={mapsUrl(project.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 underline decoration-slate-300 underline-offset-2 hover:decoration-indigo-600"
            >
              {project.address}
            </a>
          )}
        </div>
      )}
      {hasTerms && (
        <div className="flex flex-col gap-0.5 text-xs text-slate-500">
          {project.startDate && <span>Start {formatDateOnly(project.startDate)}</span>}
          {project.targetCompletionDate && <span>Target {formatDateOnly(project.targetCompletionDate)}</span>}
          {project.contractAmountCents != null && <span>Contract {formatCents(project.contractAmountCents)}</span>}
        </div>
      )}
    </div>
  );
}

// Deleting a project cascades to every transaction and category recorded
// against it, so the dialog names what goes with it rather than asking a bare
// "are you sure?".
function DeleteProjectModal({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Modal title="Delete this project?" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-700">
          <strong className="font-semibold text-slate-900">{project.name}</strong> will be permanently deleted.
        </p>
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Every estimate and actual entry on this job goes with it, along with its categories. This can&rsquo;t be undone.
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </Modal>
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
