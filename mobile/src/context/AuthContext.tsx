import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { getRefreshToken, setAccessToken, setRefreshToken } from "../lib/authStore";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await getRefreshToken();
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const body = await api.post<AuthResponse>("/auth/refresh", { refreshToken: stored });
        setAccessToken(body.accessToken);
        await setRefreshToken(body.refreshToken);
        setUser(body.user);
      } catch {
        await setRefreshToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const body = await api.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(body.accessToken);
    await setRefreshToken(body.refreshToken);
    setUser(body.user);
  }

  async function logout() {
    const stored = await getRefreshToken();
    await api.post("/auth/logout", { refreshToken: stored }).catch(() => {});
    setAccessToken(null);
    await setRefreshToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
