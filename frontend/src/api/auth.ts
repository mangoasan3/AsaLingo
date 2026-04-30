import { apiClient } from "./client";
import type { User } from "@/types";

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post<{ data: { accessToken: string; user: User } }>("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<{ data: { accessToken: string; user: User } }>("/auth/login", data),

  logout: () => apiClient.post("/auth/logout"),

  me: () => apiClient.get<{ data: User }>("/auth/me"),

  refresh: () => apiClient.post<{ data: { accessToken: string } }>("/auth/refresh"),

  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (data: { token: string; password: string }) =>
    apiClient.post("/auth/reset-password", data),
};
