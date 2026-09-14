import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/auth-storage";
import type { UserPublic } from "../types";

type AuthContextValue = {
  token: string | null;
  user: UserPublic | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: "CLIENT" | "PHARMACY";
    phone?: string;
    pharmacyId?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadSession();
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [user, setUser] = useState<UserPublic | null>(initial?.user ?? null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    saveSession(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      role: "CLIENT" | "PHARMACY";
      phone?: string;
      pharmacyId?: string;
    }) => {
      const res = await api.register(input);
      saveSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [token, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
