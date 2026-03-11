import type { Vehicle } from "./types.ts";

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
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
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
    list: () => request<Vehicle[]>("/vehicles"),
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
