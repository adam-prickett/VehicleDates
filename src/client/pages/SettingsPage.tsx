import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAlertsEnabled } from "../hooks/useAlertsEnabled.ts";
import { useCompactMode } from "../hooks/useCompactMode.ts";
import {
  NotificationChannelModal,
  type ChannelFormPayload,
} from "../components/NotificationChannelModal.tsx";
import type { NotificationChannel, NotificationPreferences, NotificationProvider } from "../types.ts";

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// --- DVLA API Key ---

function DvlaKeySection() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: keyInfo, isLoading } = useQuery({
    queryKey: ["settings", "dvla-key"],
    queryFn: api.settings.getDvlaKey,
  });

  const saveMutation = useMutation({
    mutationFn: api.settings.saveDvlaKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "dvla-key"] });
      setNewKey("");
      setShowInput(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.settings.deleteDvlaKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "dvla-key"] });
    },
  });

  return (
    <Section
      title="DVLA API Key"
      description="Used to fetch Tax and MOT dates automatically. Get a key from the DVLA Developer Portal."
    >
      {isLoading ? (
        <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
      ) : keyInfo?.isSet ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">API key configured</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                via {keyInfo.source === "environment" ? ".env file" : "settings"}
              </p>
            </div>
          </div>

          {!showInput ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowInput(true)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm cursor-pointer"
              >
                Update Key
              </button>
              {keyInfo.source === "database" && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm cursor-pointer disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Paste new API key…"
                className={inputCls}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowInput(false); setNewKey(""); }} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button
                  onClick={() => saveMutation.mutate(newKey)}
                  disabled={!newKey.trim() || saveMutation.isPending}
                  className="flex-1 bg-blue-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saveMutation.isPending ? "Saving…" : "Save Key"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300">No API key configured — Tax and MOT dates cannot be fetched automatically.</p>
          </div>
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste your DVLA API key…"
            className={inputCls}
          />
          {saveMutation.error && (
            <p className="text-red-600 dark:text-red-400 text-sm">{(saveMutation.error as Error).message}</p>
          )}
          <button
            onClick={() => saveMutation.mutate(newKey)}
            disabled={!newKey.trim() || saveMutation.isPending}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saveMutation.isPending ? "Saving…" : "Save API Key"}
          </button>
        </div>
      )}
    </Section>
  );
}

// --- Export ---

function ExportSection() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.settings.exportData();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `vehicle-dates-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Section
      title="Export Data"
      description="Download all your vehicle data as a JSON file. Use this to back up your data or move it to another device."
    >
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {exporting ? "Preparing download…" : "Download JSON export"}
      </button>
    </Section>
  );
}

// --- Import ---

function ImportSection() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ imported: number; updated: number; total: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: api.settings.importData,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setResult(res);
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.vehicles || !Array.isArray(json.vehicles)) {
        setParseError("Invalid export file — missing vehicles array.");
        return;
      }
      importMutation.mutate(json);
    } catch {
      setParseError("Could not parse file. Make sure it is a valid Vehicle Dates export.");
    }
  }

  return (
    <Section
      title="Import Data"
      description="Restore from a previously exported JSON file. Existing vehicles will be updated; new ones will be added."
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl px-4 py-5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer text-gray-600 dark:text-gray-400 text-sm justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {importMutation.isPending ? "Importing…" : "Choose JSON export file"}
          <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} disabled={importMutation.isPending} />
        </label>

        {parseError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-700 dark:text-red-300 text-sm">
            {parseError}
          </div>
        )}
        {importMutation.error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-700 dark:text-red-300 text-sm">
            {(importMutation.error as Error).message}
          </div>
        )}
        {result && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-green-800 dark:text-green-300 text-sm">
            Import complete — {result.imported} added, {result.updated} updated ({result.total} total).
          </div>
        )}
      </div>
    </Section>
  );
}

// --- Dashboard alerts ---

function CompactModeSection() {
  const { enabled, toggle } = useCompactMode();

  return (
    <Section
      title="Compact Dashboard"
      description="Render the dashboard as a single-column list with the registration on the left and a status icon on the right. Useful on small screens or when you only want an at-a-glance view."
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {enabled ? "Compact view enabled" : "Compact view disabled"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Preference is saved per device.
          </p>
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle compact dashboard view"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors cursor-pointer focus:outline-none ${
            enabled
              ? "bg-blue-600 border-blue-600"
              : "bg-gray-200 dark:bg-gray-600 border-gray-200 dark:border-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </Section>
  );
}

function AlertsSection() {
  const { enabled, toggle } = useAlertsEnabled();

  return (
    <Section
      title="Dashboard Alerts"
      description="Show colour-coded notifications at the top of the dashboard for Tax, MOT, Insurance and Service dates due within 30 days or already overdue."
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {enabled ? "Alerts are enabled" : "Alerts are disabled"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Preference is saved per device.
          </p>
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle dashboard alerts"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors cursor-pointer focus:outline-none ${
            enabled
              ? "bg-blue-600 border-blue-600"
              : "bg-gray-200 dark:bg-gray-600 border-gray-200 dark:border-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </Section>
  );
}

// --- Notification preferences (master switch + timing + lead days) ---

const LEAD_DAY_OPTIONS = [30, 14, 7, 3, 1, 0];
const EVENT_LABELS: Record<"Tax" | "MOT" | "Insurance" | "Service", keyof Pick<NotificationPreferences, "leadDaysTax" | "leadDaysMot" | "leadDaysInsurance" | "leadDaysService">> = {
  Tax: "leadDaysTax",
  MOT: "leadDaysMot",
  Insurance: "leadDaysInsurance",
  Service: "leadDaysService",
};

function getTimezoneList(): string[] {
  // Modern browsers expose the full IANA list. Node (during SSR / tests) may not.
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported.call(Intl, "timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "UTC",
    "Europe/London",
    "Europe/Dublin",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
  ];
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function LeadDayChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(day: number) {
    const next = value.includes(day)
      ? value.filter((v) => v !== day)
      : [...value, day].sort((a, b) => a - b);
    onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEAD_DAY_OPTIONS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              on
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            }`}
            aria-pressed={on}
          >
            {d === 0 ? "Day of" : `${d} days`}
          </button>
        );
      })}
    </div>
  );
}

function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const queryKey = ["notifications", "preferences"];

  const { data: prefs, isLoading } = useQuery({
    queryKey,
    queryFn: api.notifications.getPreferences,
  });

  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs) setDraft((d) => d ?? prefs);
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: api.notifications.savePreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setDraft(updated);
    },
  });

  const timezoneList = useMemo(getTimezoneList, []);
  const dirty = useMemo(() => {
    if (!prefs || !draft) return false;
    return JSON.stringify(prefs) !== JSON.stringify(draft);
  }, [prefs, draft]);

  function update<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setLeadDays(field: keyof typeof EVENT_LABELS, value: number[]) {
    setDraft((d) => (d ? { ...d, [EVENT_LABELS[field]]: value } : d));
  }

  function handleSave() {
    if (!draft) return;
    saveMutation.mutate({
      enabled: draft.enabled,
      leadDaysTax: draft.leadDaysTax,
      leadDaysMot: draft.leadDaysMot,
      leadDaysInsurance: draft.leadDaysInsurance,
      leadDaysService: draft.leadDaysService,
      sendHour: draft.sendHour,
      sendMinute: 0,
      timezone: draft.timezone,
    });
  }

  function handleUseBrowserTimezone() {
    update("timezone", browserTimezone());
  }

  if (isLoading || !draft) {
    return (
      <Section title="Notifications">
        <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
      </Section>
    );
  }

  return (
    <Section
      title="Notifications"
      description="Master switch and timing for scheduled reminders. Channels below decide where the alerts are delivered."
    >
      {/* Master switch */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {draft.enabled ? "Notifications are enabled" : "Notifications are disabled"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Required for any channel to fire — overrides per-channel toggles.
          </p>
        </div>
        <button
          onClick={() => update("enabled", !draft.enabled)}
          role="switch"
          aria-checked={draft.enabled}
          aria-label="Toggle notifications"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors cursor-pointer focus:outline-none ${
            draft.enabled
              ? "bg-blue-600 border-blue-600"
              : "bg-gray-200 dark:bg-gray-600 border-gray-200 dark:border-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              draft.enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* When to send */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Send at
          </label>
          <select
            value={draft.sendHour}
            onChange={(e) => update("sendHour", parseInt(e.target.value))}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Timezone
          </label>
          <select
            value={draft.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {!timezoneList.includes(draft.timezone) && (
              <option value={draft.timezone}>{draft.timezone}</option>
            )}
            {timezoneList.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {draft.timezone !== browserTimezone() && (
            <button
              onClick={handleUseBrowserTimezone}
              className="text-[11px] text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
            >
              Use this device's timezone ({browserTimezone()})
            </button>
          )}
        </div>
      </div>

      {/* Lead-day chips */}
      <div className="pt-2 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Remind me at
        </p>
        {(Object.entries(EVENT_LABELS) as Array<[
          keyof typeof EVENT_LABELS,
          keyof NotificationPreferences,
        ]>).map(([label, field]) => (
          <div key={label}>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">{label}</p>
            <LeadDayChips
              value={draft[field] as number[]}
              onChange={(v) => setLeadDays(label, v)}
            />
          </div>
        ))}
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unsaved changes</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDraft(prefs ?? null)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {saveMutation.error && (
        <p className="text-red-600 dark:text-red-400 text-xs">
          {(saveMutation.error as Error).message}
        </p>
      )}
    </Section>
  );
}

// --- Notification channels ---

type ChannelEditTarget = NotificationChannel | "new" | null;

/**
 * Build a one-line summary of a channel's config using whichever non-secret,
 * non-empty fields the provider declares. Hides obvious password fields and
 * any field whose value is null/empty.
 */
function summarizeChannel(
  channel: NotificationChannel,
  providers: NotificationProvider[] | undefined
): string {
  const provider = providers?.find((p) => p.type === channel.type);
  if (!provider) return "";
  const cfg = channel.config as Record<string, unknown>;
  const parts: string[] = [];
  for (const field of provider.fields) {
    if (field.type === "password") continue;
    const raw = cfg[field.name];
    if (typeof raw !== "string" || raw.trim().length === 0) continue;
    parts.push(raw);
  }
  return parts.join(" · ");
}

function NotificationChannelsSection() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ChannelEditTarget>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; message: string } | null>(null);

  const channelsKey = ["notifications", "channels"];

  const { data: providers } = useQuery({
    queryKey: ["notifications", "providers"],
    queryFn: api.notifications.listProviders,
    staleTime: 5 * 60_000,
  });

  const { data: channels, isLoading } = useQuery({
    queryKey: channelsKey,
    queryFn: api.notifications.listChannels,
  });

  const createMutation = useMutation({
    mutationFn: (data: ChannelFormPayload) => api.notifications.createChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKey });
      setTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChannelFormPayload }) =>
      api.notifications.updateChannel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKey });
      setTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.notifications.updateChannel(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelsKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.notifications.deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKey });
      setDeleteId(null);
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => api.notifications.testChannel(id),
    onSuccess: (_, id) => {
      setTestResult({ id, ok: true, message: "Test notification sent." });
      setTimeout(() => setTestResult((r) => (r?.id === id ? null : r)), 4000);
    },
    onError: (err: Error, id) => {
      setTestResult({ id, ok: false, message: err.message });
    },
  });

  function handleSave(payload: ChannelFormPayload) {
    if (target && target !== "new") {
      updateMutation.mutate({ id: target.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const saveError = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <Section
      title="Notification Channels"
      description="Send reminders about upcoming Tax, MOT, Insurance and Service dates to your phone or any device that subscribes to your channel."
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {channels && channels.length > 0
            ? `${channels.length} channel${channels.length !== 1 ? "s" : ""} configured`
            : "No channels configured."}
        </p>
        <button
          onClick={() => setTarget("new")}
          className="text-blue-600 text-sm font-medium hover:text-blue-800 cursor-pointer"
        >
          + Add channel
        </button>
      </div>

      {isLoading ? (
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
      ) : channels && channels.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
          {channels.map((channel) => {
            const cfg = channel.config as Record<string, unknown>;
            const isDeleting = deleteId === channel.id;
            const isThisTestResult = testResult?.id === channel.id ? testResult : null;
            return (
              <li key={channel.id} className="py-3 first:pt-0 last:pb-0 px-1">
                {isDeleting ? (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-red-800 dark:text-red-300 text-sm text-center mb-2">
                      Delete "{channel.label}"? Past send history will also be removed.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteId(null)}
                        className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(channel.id)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 bg-red-600 text-white font-semibold py-1.5 rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                          {channel.label}
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          {channel.type}
                        </span>
                      </div>
                      {summarizeChannel(channel, providers) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {summarizeChannel(channel, providers)}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => testMutation.mutate(channel.id)}
                          disabled={testMutation.isPending}
                          className="text-blue-600 text-xs font-medium hover:text-blue-800 disabled:opacity-50 cursor-pointer"
                        >
                          {testMutation.isPending && testMutation.variables === channel.id
                            ? "Sending…"
                            : "Test"}
                        </button>
                        <button
                          onClick={() => setTarget(channel)}
                          className="text-blue-600 text-xs font-medium hover:text-blue-800 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(channel.id)}
                          className="text-red-600 text-xs font-medium hover:text-red-800 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      {isThisTestResult && (
                        <p
                          className={`text-xs mt-1.5 ${
                            isThisTestResult.ok
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isThisTestResult.message}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: channel.id, enabled: !channel.enabled })
                      }
                      role="switch"
                      aria-checked={channel.enabled}
                      aria-label={`Toggle ${channel.label}`}
                      className={`flex-shrink-0 relative inline-flex h-6 w-11 rounded-full border-2 transition-colors cursor-pointer focus:outline-none ${
                        channel.enabled
                          ? "bg-blue-600 border-blue-600"
                          : "bg-gray-200 dark:bg-gray-600 border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                          channel.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {target && (
        <NotificationChannelModal
          channel={target === "new" ? null : target}
          providers={providers ?? []}
          onSave={handleSave}
          onClose={() => setTarget(null)}
          isSaving={saving}
          error={saveError?.message ?? null}
        />
      )}
    </Section>
  );
}

// --- Notification activity ---

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return new Date(iso).toLocaleString();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

const EVENT_LABEL: Record<string, string> = {
  tax: "Road Tax",
  mot: "MOT",
  insurance: "Insurance",
  service: "Service",
};

function NotificationActivitySection() {
  const [expanded, setExpanded] = useState(false);

  const { data: log, isLoading } = useQuery({
    queryKey: ["notifications", "log"],
    queryFn: () => api.notifications.listLog(20),
    refetchInterval: 30_000,
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.vehicles.list(),
    staleTime: 60_000,
  });

  const { data: channels } = useQuery({
    queryKey: ["notifications", "channels"],
    queryFn: api.notifications.listChannels,
  });

  const vehicleMap = useMemo(() => {
    const m = new Map<number, string>();
    (vehicles ?? []).forEach((v) => m.set(v.id, v.registrationNumber));
    return m;
  }, [vehicles]);

  const channelMap = useMemo(() => {
    const m = new Map<number, string>();
    (channels ?? []).forEach((c) => m.set(c.id, c.label));
    return m;
  }, [channels]);

  if (isLoading) {
    return (
      <Section title="Notification Activity">
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
      </Section>
    );
  }

  const rows = log ?? [];
  if (rows.length === 0) {
    return (
      <Section title="Notification Activity" description="Recent sends across all your channels.">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-2">
          No notifications sent yet.
        </p>
      </Section>
    );
  }

  const visible = expanded ? rows : rows.slice(0, 5);
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <Section
      title="Notification Activity"
      description="Recent sends across all your channels."
    >
      {failedCount > 0 && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-red-700 dark:text-red-300">
            <span className="font-semibold">
              {failedCount} failed send{failedCount === 1 ? "" : "s"}
            </span>{" "}
            in the last {rows.length} attempts. After {3} consecutive failures for the same alert the scheduler stops retrying until the underlying date changes.
          </p>
        </div>
      )}
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {visible.map((row) => {
          const reg = vehicleMap.get(row.vehicleId) ?? `Vehicle #${row.vehicleId}`;
          const channelLabel = channelMap.get(row.channelId) ?? `Channel #${row.channelId}`;
          const event = EVENT_LABEL[row.eventType] ?? row.eventType;
          const failed = row.status === "failed";
          return (
            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {failed ? (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                      <span className="font-semibold">{reg}</span>
                      <span className="text-gray-500 dark:text-gray-400"> — {event}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {" "}· {row.leadDays === 0 ? "day of" : `${row.leadDays}d lead`}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {relativeTime(row.sentAt)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    via <span className="font-medium text-gray-600 dark:text-gray-300">{channelLabel}</span>
                  </p>
                  {failed && row.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 break-words">
                      {row.error}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > 5 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
        >
          {expanded ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </Section>
  );
}

// --- Page ---

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
      <AlertsSection />
      <CompactModeSection />
      <NotificationPreferencesSection />
      <NotificationChannelsSection />
      <NotificationActivitySection />
      <DvlaKeySection />
      <ExportSection />
      <ImportSection />
    </div>
  );
}
