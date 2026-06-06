import type {
  Vehicle,
  AuthUser,
  User,
  ServiceTask,
  NotificationProvider,
  NotificationChannel,
  NotificationPreferences,
  NotificationLogEntry,
  NotificationRunSummary,
} from "./types.ts";

interface ChannelInput {
  type: string;
  label: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

interface ChannelUpdate {
  type?: string;
  label?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

interface PreferencesInput {
  enabled: boolean;
  leadDaysTax: number[];
  leadDaysMot: number[];
  leadDaysInsurance: number[];
  leadDaysService: number[];
  sendHour: number;
  sendMinute: number;
  timezone: string;
}

interface ServiceTaskInput {
  type: string;
  date: string;
  mileage?: number | null;
  cost?: number | null;
  notes?: string | null;
}

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
      request<{ isSet: boolean; source: "database" | "environment" | null }>(
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
        make: string | null;
        model: string | null;
        notes: string | null;
        colour: string | null;
        insuranceExpiryDate: string | null;
        insuranceProvider: string | null;
        insurancePolicyNumber: string | null;
        insurancePremium: number | null;
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
  insurance: {
    certificateUrl: (vehicleId: number) =>
      `${BASE}/vehicles/${vehicleId}/insurance-certificate`,
    uploadCertificate: async (vehicleId: number, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/vehicles/${vehicleId}/insurance-certificate`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error ?? `Upload failed: ${res.status}`);
      }
      return res.json() as Promise<Vehicle>;
    },
    deleteCertificate: (vehicleId: number) =>
      request<Vehicle>(`/vehicles/${vehicleId}/insurance-certificate`, {
        method: "DELETE",
      }),
  },
  notifications: {
    listProviders: () => request<NotificationProvider[]>("/notifications/providers"),
    getPreferences: () => request<NotificationPreferences>("/notifications/preferences"),
    savePreferences: (data: PreferencesInput) =>
      request<NotificationPreferences>("/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listChannels: () => request<NotificationChannel[]>("/notifications/channels"),
    createChannel: (data: ChannelInput) =>
      request<NotificationChannel>("/notifications/channels", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateChannel: (id: number, data: ChannelUpdate) =>
      request<NotificationChannel>(`/notifications/channels/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteChannel: (id: number) =>
      request<{ success: boolean }>(`/notifications/channels/${id}`, {
        method: "DELETE",
      }),
    testChannel: (id: number) =>
      request<{ success: boolean; error?: string }>(
        `/notifications/channels/${id}/test`,
        { method: "POST" }
      ),
    listLog: (limit?: number) =>
      request<NotificationLogEntry[]>(
        `/notifications/log${limit ? `?limit=${limit}` : ""}`
      ),
    runNow: () =>
      request<NotificationRunSummary>("/notifications/run-now", {
        method: "POST",
      }),
  },
  serviceTasks: {
    list: (vehicleId: number) =>
      request<ServiceTask[]>(`/vehicles/${vehicleId}/service-tasks`),
    create: (vehicleId: number, data: ServiceTaskInput) =>
      request<ServiceTask>(`/vehicles/${vehicleId}/service-tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (vehicleId: number, taskId: number, data: Partial<ServiceTaskInput>) =>
      request<ServiceTask>(`/vehicles/${vehicleId}/service-tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (vehicleId: number, taskId: number) =>
      request<{ success: boolean }>(
        `/vehicles/${vehicleId}/service-tasks/${taskId}`,
        { method: "DELETE" }
      ),
  },
};
