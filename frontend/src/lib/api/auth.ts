import { apiJson } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  mustChangePassword: boolean;
};

export type SessionResponse = {
  user: AuthUser | null;
  csrfToken: string | null;
};

export const authApi = {
  me: () => apiJson<SessionResponse>("/api/auth/me", { cache: "no-store" }),
  checkEmail: (email: string) => apiJson<{ allowed: boolean }>("/api/auth/check-email", { method: "POST", json: { email } }),
  login: (email: string, password: string) =>
    apiJson<SessionResponse>("/api/auth/login", { method: "POST", json: { email, password } }),
  register: (email: string, displayName: string) =>
    apiJson<{ message: string }>("/api/auth/register", {
      method: "POST",
      json: { email, displayName },
    }),
  changePassword: (password: string) =>
    apiJson<SessionResponse>("/api/auth/change-password", { method: "POST", json: { password } }),
  updateProfile: (displayName: string) =>
    apiJson<SessionResponse>("/api/auth/profile", {
      method: "PATCH",
      json: { displayName },
    }),
  uploadAvatar: (image: File) => {
    const form = new FormData();
    form.set("image", image);
    return apiJson<SessionResponse>("/api/auth/avatar", { method: "PUT", body: form });
  },
  removeAvatar: () => apiJson<SessionResponse>("/api/auth/avatar", { method: "DELETE" }),
  logout: () => apiJson<{ message: string }>("/api/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    apiJson<{ message: string }>("/api/auth/forgot-password", { method: "POST", json: { email } }),
  resetPassword: (token: string, password: string) =>
    apiJson<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      json: { token, password },
    }),
};
