import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken } from "./lib/authStore";

// Unlike the web app (same-origin, served by the same Express process), the
// mobile app always talks to the API over the network. Defaults to the
// deployed instance so the app works out of the box for the end user;
// override via EXPO_PUBLIC_API_URL when testing against a local dev server.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://sitebook-production.up.railway.app";

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const stored = await getRefreshToken();
      if (!stored) return false;
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: stored }),
        });
        if (!res.ok) {
          await setRefreshToken(null);
          setAccessToken(null);
          return false;
        }
        const body = await res.json();
        setAccessToken(body.accessToken);
        // The refresh token rotates on every use — the old one is now
        // revoked server-side, so the new one must be persisted or the
        // *next* refresh attempt will fail.
        await setRefreshToken(body.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// For requests that bypass `request()` (e.g. expo-file-system's direct-to-disk
// download, used for the PDF report) — retries once after a token refresh if
// the wrapped call fails with a 401.
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401")) {
      const refreshed = await doRefresh();
      if (refreshed) return fn();
    }
    throw err;
  }
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
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

export { API_URL };
