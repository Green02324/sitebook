import { getAccessToken, setAccessToken } from "./lib/tokenStore";
import type { User } from "./types";

export interface RefreshResult {
  accessToken: string;
  user: User;
}

let refreshPromise: Promise<RefreshResult | null> | null = null;

// Single-flight, and the only place the app is allowed to call /auth/refresh.
// Refresh tokens rotate: the server revokes the presented token and treats a
// second use of it as theft, clearing the cookie outright. So two overlapping
// refreshes don't just race — the loser destroys the session the winner just
// established. Everything funnels through this one in-flight promise so that
// can't happen to us.
export function refreshSession(): Promise<RefreshResult | null> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return null;
        }
        const body = (await res.json()) as RefreshResult;
        setAccessToken(body.accessToken);
        return body;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  return (await refreshSession()) !== null;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers as Record<string, string> | undefined) },
  });

  if (res.status === 401 && !isRetry) {
    let code: string | undefined;
    try {
      const body = await res.clone().json();
      code = body?.error;
    } catch {
      // ignore non-JSON body
    }
    if (code === "TOKEN_EXPIRED" || !getAccessToken()) {
      const refreshed = await doRefresh();
      if (refreshed) return request<T>(path, options, true);
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function fetchBlob(path: string, isRetry = false): Promise<Blob> {
  const res = await fetch(`/api${path}`, { credentials: "include", headers: authHeaders() });
  if (res.status === 401 && !isRetry) {
    const refreshed = await doRefresh();
    if (refreshed) return fetchBlob(path, true);
  }
  if (!res.ok) throw new Error("Failed to download file");
  return res.blob();
}
