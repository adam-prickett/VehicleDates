import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "../api.ts";
import type { AuthUser } from "../types.ts";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setupNeeded: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeSetup: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
      setSetupNeeded(false);
    } catch {
      setUser(null);
      try {
        const { needed } = await api.auth.setupStatus();
        setSetupNeeded(needed);
      } catch {
        setSetupNeeded(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Listen for 401s from protected API calls (e.g. expired JWT)
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  async function login(username: string, password: string) {
    const me = await api.auth.login(username, password);
    setUser(me);
    setSetupNeeded(false);
  }

  async function logout() {
    await api.auth.logout();
    setUser(null);
  }

  async function completeSetup(username: string, password: string) {
    const me = await api.auth.setup(username, password);
    setUser(me);
    setSetupNeeded(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, setupNeeded, login, logout, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
