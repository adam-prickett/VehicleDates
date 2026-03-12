import type { Vehicle, AuthUser, User } from "./types.ts";

const BASE = "/api";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    me: () => request<AuthUser>("/auth/me"),
    setupStatus: () => request<{ needed: boolean }>("/auth/setup"),
    login: (username: string, password: string) =>
      request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
    setup: (username: string, password: string) =>
      request<AuthUser>("/auth/setup", { method: "POST", body: JSON.stringify({ username, password }) }),
  },
  users: {
    list: () => request<User[]>("/users"),
    create: (data: { username: string; password: string; role: "admin" | "user" }) =>
      request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
    changePassword: (id: number, password: string) =>
      request<User>(`/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/users/${id}`, { method: "DELETE" }),
  },
  settings: {
    getDvlaKey: () =>
      request<{ isSet: boolean; hint: string | null; source: "database" | "environment" | null }>(
        "/settings/dvla-key"
      ),
    saveDvlaKey: (apiKey: string) =>
      request<{ success: boolean }>("/settings/dvla-key", {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      }),
    deleteDvlaKey: () =>
      request<{ success: boolean }>("/settings/dvla-key", { method: "DELETE" }),
    exportData: () => fetch("/api/settings/export"),
    importData: (data: unknown) =>
      request<{ imported: number; updated: number; total: number }>(
        "/settings/import",
        { method: "POST", body: JSON.stringify(data) }
      ),
  },
  vehicles: {
    list: (archived?: boolean) =>
      request<Vehicle[]>(archived ? "/vehicles?archived=true" : "/vehicles"),
    get: (id: number) => request<Vehicle>(`/vehicles/${id}`),
    create: (data: {
      registrationNumber: string;
      v5DocumentNumber?: string;
      model?: string;
      notes?: string;
    }) =>
      request<Vehicle>("/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: Partial<{
        v5DocumentNumber: string | null;
        model: string | null;
        notes: string | null;
        colour: string | null;
        insuranceExpiryDate: string | null;
        insuranceProvider: string | null;
        serviceDate: string | null;
        serviceIntervalMonths: number | null;
        taxDueDate: string | null;
        motExpiryDate: string | null;
        manualSorn: boolean;
      }>
    ) =>
      request<Vehicle>(`/vehicles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/vehicles/${id}`, {
        method: "DELETE",
      }),
    archive: (
      id: number,
      data: { reason: string; saleDate?: string | null; buyerName?: string | null; buyerContact?: string | null }
    ) =>
      request<Vehicle>(`/vehicles/${id}/archive`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    unarchive: (id: number) =>
      request<Vehicle>(`/vehicles/${id}/unarchive`, { method: "POST" }),
    refresh: (id: number) =>
      request<{ success: boolean; found: boolean; vehicle: Vehicle }>(
        `/vehicles/${id}/refresh`,
        { method: "POST" }
      ),
    refreshAll: () =>
      request<{ success: number; failed: number }>("/vehicles/refresh-all", {
        method: "POST",
      }),
  },
};
