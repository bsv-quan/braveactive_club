"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi, type AuthUser, type SessionResponse } from "@/lib/api/auth";
import { setCsrfToken } from "@/lib/api/client";

type AuthContextValue = {
  user: AuthUser | null;
  /** True until the first `/api/auth/me` response arrives. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  register: (email: string, displayName: string) => Promise<{ message: string }>;
  changePassword: (password: string) => Promise<AuthUser | null>;
  updateProfile: (displayName: string) => Promise<AuthUser | null>;
  uploadAvatar: (image: File) => Promise<AuthUser | null>;
  removeAvatar: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const applySession = useCallback((session: SessionResponse) => {
    setCsrfToken(session.csrfToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then(applySession)
      .catch(() => applySession({ user: null, csrfToken: null }))
      .finally(() => setLoading(false));
  }, [applySession]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== "/change-password" && pathname !== "/login") {
      router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, user?.mustChangePassword]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login(email, password);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(async (email: string, displayName: string) => authApi.register(email, displayName), []);

  const changePassword = useCallback(
    async (password: string) => {
      const session = await authApi.changePassword(password);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const updateProfile = useCallback(async (displayName: string) => {
    const session = await authApi.updateProfile(displayName);
    applySession(session);
    return session.user;
  }, [applySession]);

  const uploadAvatar = useCallback(async (image: File) => {
    const session = await authApi.uploadAvatar(image);
    applySession(session);
    return session.user;
  }, [applySession]);

  const removeAvatar = useCallback(async () => {
    const session = await authApi.removeAvatar();
    applySession(session);
    return session.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    applySession({ user: null, csrfToken: null });
  }, [applySession]);

  const value = useMemo(
    () => ({ user, loading, login, register, changePassword, updateProfile, uploadAvatar, removeAvatar, logout }),
    [user, loading, login, register, changePassword, updateProfile, uploadAvatar, removeAvatar, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
