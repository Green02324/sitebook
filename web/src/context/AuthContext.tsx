import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, refreshSession } from "../api";
import { setAccessToken } from "../lib/tokenStore";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  accessToken: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Silent login: the refresh cookie (if any) lets a page reload restore the
    // session without re-entering credentials. This goes through the shared
    // single-flight helper rather than its own fetch — StrictMode runs this
    // effect twice in development, and two overlapping refreshes get the second
    // one rejected as token reuse, which clears the cookie and logs the user
    // straight back out.
    refreshSession()
      .then((body) => {
        if (body) setUser(body.user);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const body = await api.post<LoginResponse>("/auth/login", { email, password });
    setAccessToken(body.accessToken);
    setUser(body.user);
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
