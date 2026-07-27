import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useView, withViewParams } from "../context/ViewContext";
import { useIsMobile } from "../lib/useIsMobile";
import { api } from "../api";
import type { Project } from "../types";

function basePath(readOnly: boolean, targetUserId: string): string {
  return readOnly ? `/admin/users/${targetUserId}` : "";
}

function ProjectsNavList({ onNavigate }: { onNavigate?: () => void }) {
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
        <NavLink to={`${prefix}/projects`} className="text-sm font-medium hover:text-white" onClick={onNavigate}>
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
              onClick={onNavigate}
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

function NavContent({
  prefix,
  isAdmin,
  readOnly,
  onNavigate,
  onLogout,
}: {
  prefix: string;
  isAdmin: boolean;
  readOnly: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`;

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        <NavLink to={`${prefix}/dashboard`} className={linkClass} onClick={onNavigate}>
          Dashboard
        </NavLink>
        <ProjectsNavList onNavigate={onNavigate} />
        <NavLink to={`${prefix}/overhead`} className={linkClass} onClick={onNavigate}>
          Overhead
        </NavLink>
        <NavLink to={`${prefix}/annual-report`} className={linkClass} onClick={onNavigate}>
          Annual Report
        </NavLink>
        {!readOnly && isAdmin && (
          <NavLink to="/admin" className={linkClass} onClick={onNavigate}>
            Admin
          </NavLink>
        )}
        {!readOnly && (
          <NavLink to="/profile" className={linkClass} onClick={onNavigate}>
            Profile
          </NavLink>
        )}
      </nav>
      <div className="border-t border-slate-800 p-2">
        <button
          onClick={onLogout}
          className="w-full rounded px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const view = useView();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const prefix = basePath(view.readOnly, view.targetUserId);
  const isAdmin = user?.role === "ADMIN";

  if (isMobile) {
    return (
      <>
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
          <span className="text-lg font-bold tracking-tight">SiteBook</span>
          <button onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu" className="p-1 text-2xl leading-none">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
            <div
              className="flex h-full w-64 flex-col overflow-y-auto bg-slate-900 pb-safe text-slate-200 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-lg font-bold tracking-tight text-white">SiteBook</div>
              <NavContent prefix={prefix} isAdmin={isAdmin} readOnly={view.readOnly} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex w-64 flex-shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="px-4 py-5 text-lg font-bold tracking-tight text-white">SiteBook</div>
      <NavContent prefix={prefix} isAdmin={isAdmin} readOnly={view.readOnly} onLogout={handleLogout} />
    </div>
  );
}
