import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useView } from "../context/ViewContext";

export function Layout() {
  const view = useView();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {view.readOnly && (
          <div className="flex items-center justify-between bg-indigo-600 px-6 py-2 text-sm font-medium text-white">
            <span>Viewing {view.targetUserName ?? "this user"}&rsquo;s account — read-only</span>
            <Link to="/admin" className="underline">
              Exit
            </Link>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
