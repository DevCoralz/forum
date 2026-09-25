import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginRequest, logout as logoutRequest, me, type AuthUser } from "@/services/auth";
import { getToken } from "@/services/api";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  refresh: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      setUser(await me());
      setStatus("signedIn");
    } catch {
      setUser(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await loginRequest(username, password);
    setUser(result.user);
    setStatus("signedIn");
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(
    () => ({ user, status, refresh, signIn, signOut }),
    [user, status, refresh, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
