import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface ViewContextValue {
  targetUserId: string;
  readOnly: boolean;
  targetUserName?: string;
}

const ViewContext = createContext<ViewContextValue | null>(null);

// Wraps admin drill-in routes so every nested page (Dashboard, ProjectsList,
// ProjectDetail, ...) reads/writes the target user's data instead of the
// admin's own, without those pages needing to know they're in admin mode.
export function ViewAsProvider({ userId, userName, children }: { userId: string; userName?: string; children: ReactNode }) {
  return <ViewContext.Provider value={{ targetUserId: userId, readOnly: true, targetUserName: userName }}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  const { user } = useAuth();
  if (ctx) return ctx;
  return { targetUserId: user?.id ?? "", readOnly: false };
}

// Admin read-only GETs need ?asUserId=<id>; every other request (including
// all non-GET calls, which the UI never issues while readOnly) should omit
// it so it operates as the caller's own account.
export function withViewParams(path: string, view: Pick<ViewContextValue, "readOnly" | "targetUserId">): string {
  if (!view.readOnly) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}asUserId=${encodeURIComponent(view.targetUserId)}`;
}
