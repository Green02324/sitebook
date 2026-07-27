import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useView, withViewParams } from "../context/ViewContext";
import { api } from "../api";
import type { Project } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

function ProjectsNavList() {
  const view = useView();
  const [open, setOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const prefix = basePath(view.readOnly, view.targetUserId);

  useEffect(() => {
    api
      .get<Project[]>(withViewParams("/projects", view))
      .then(setProjects)
      .catch(() => {});
  }, [view.targetUserId, view.readOnly]);

  return (
    <div>
      <div className="flex items-center justify-between rounded px-3 py-2 text-slate-300">
        <NavLink to={`${prefix}/projects`} className="text-sm font-medium hover:text-white">
          Projects
        </NavLink>
        <button onClick={() => setOpen((o) => !o)} aria-label="Toggle projects list" className="text-slate-400 hover:text-white">
          {open ? "▾" : "▸"}
        </button>
      </div>
      {open && (
        <div className="ml-3 flex flex-col gap-1 border-l border-slate-700 pl-3">
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={`${prefix}/projects/${p.id}`}
              className={({ isActive }) =>
                `truncate rounded px-2 py-1 text-sm ${isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`
              }
            >
              {p.name}
            </NavLink>
          ))}
          {projects.length === 0 && <span className="px-2 py-1 text-sm text-slate-500">No projects yet</span>}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const view = useView();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const prefix = basePath(view.readOnly, view.targetUserId);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`;

  return (
    <div className="flex w-64 flex-shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="px-4 py-5 text-lg font-bold tracking-tight text-white">SiteBook</div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        <NavLink to={`${prefix}/dashboard`} className={linkClass}>
          Dashboard
        </NavLink>
        <ProjectsNavList />
        {!view.readOnly && user?.role === "ADMIN" && (
          <NavLink to="/admin" className={linkClass}>
            Admin
          </NavLink>
        )}
        {!view.readOnly && (
          <NavLink to="/profile" className={linkClass}>
            Profile
          </NavLink>
        )}
      </nav>
      <div className="border-t border-slate-800 p-2">
        <button
          onClick={handleLogout}
          className="w-full rounded px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
