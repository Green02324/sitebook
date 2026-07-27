import { getAccessToken, setAccessToken } from "./lib/tokenStore";

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const body = await res.json();
        setAccessToken(body.accessToken);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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
