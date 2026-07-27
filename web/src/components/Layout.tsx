import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useView } from "../context/ViewContext";

export function Layout() {
  const view = useView();

  // h-dvh rather than h-screen: the dynamic unit tracks mobile Safari's
  // collapsing address bar, so the shell isn't left an address-bar too tall.
  return (
    <div className="flex h-dvh flex-col bg-slate-50 md:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {view.readOnly && (
          <div className="flex items-center justify-between gap-3 bg-indigo-600 px-4 py-2 text-sm font-medium text-white md:px-6">
            <span>Viewing {view.targetUserName ?? "this user"}&rsquo;s account — read-only</span>
            <Link to="/admin" className="shrink-0 underline">
              Exit
            </Link>
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-safe pb-safe">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
