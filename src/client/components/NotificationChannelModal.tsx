import { useEffect, useRef, useState } from "react";
import type { NotificationChannel, NotificationProvider } from "../types.ts";

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

export interface ChannelFormPayload {
  type: string;
  label: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface Props {
  channel: NotificationChannel | null; // null = new
  providers: NotificationProvider[];
  onSave: (payload: ChannelFormPayload) => void;
  onClose: () => void;
  isSaving?: boolean;
  error?: string | null;
}

interface FormState {
  type: string;
  label: string;
  enabled: boolean;
  // ntfy-specific (the only provider for now)
  ntfyServer: string;
  ntfyTopic: string;
  ntfyAuthToken: string;
}

function emptyForm(providers: NotificationProvider[]): FormState {
  return {
    type: providers[0]?.type ?? "ntfy",
    label: "",
    enabled: true,
    ntfyServer: "https://ntfy.sh",
    ntfyTopic: "",
    ntfyAuthToken: "",
  };
}

function channelToForm(c: NotificationChannel): FormState {
  const cfg = c.config as Record<string, unknown>;
  return {
    type: c.type,
    label: c.label,
    enabled: c.enabled,
    ntfyServer: (cfg.server as string) ?? "https://ntfy.sh",
    ntfyTopic: (cfg.topic as string) ?? "",
    ntfyAuthToken: (cfg.authToken as string) ?? "",
  };
}

export function NotificationChannelModal({
  channel,
  providers,
  onSave,
  onClose,
  isSaving,
  error,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    channel ? channelToForm(channel) : emptyForm(providers)
  );
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  function handleSubmit() {
    if (!form.label.trim()) return;
    let config: Record<string, unknown> = {};
    if (form.type === "ntfy") {
      if (!form.ntfyTopic.trim()) return;
      config = {
        server: form.ntfyServer.trim() || "https://ntfy.sh",
        topic: form.ntfyTopic.trim(),
        authToken: form.ntfyAuthToken.trim() || null,
      };
    }
    onSave({
      type: form.type,
      label: form.label.trim(),
      config,
      enabled: form.enabled,
    });
  }

  const isEditing = channel != null;
  const heading = isEditing ? "Edit Channel" : "New Notification Channel";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-backdrop-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-modal-slide-up sm:animate-modal-fade-zoom origin-bottom sm:origin-center">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">{heading}</h2>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors p-1 -mr-1 cursor-pointer"
            aria-label="Close"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className={labelCls}>Provider</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              disabled={isEditing}
              className={inputCls}
            >
              {providers.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.label}
                </option>
              ))}
            </select>
            {isEditing && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Provider type can't be changed after creation. Delete and re-add to switch.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Home phone"
              className={inputCls}
            />
          </div>

          {form.type === "ntfy" && (
            <>
              <div>
                <label className={labelCls}>Server</label>
                <input
                  type="url"
                  value={form.ntfyServer}
                  onChange={(e) => setForm({ ...form, ntfyServer: e.target.value })}
                  placeholder="https://ntfy.sh"
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Defaults to the public ntfy.sh. Use your own instance URL if self-hosted.
                </p>
              </div>
              <div>
                <label className={labelCls}>Topic</label>
                <input
                  type="text"
                  value={form.ntfyTopic}
                  onChange={(e) => setForm({ ...form, ntfyTopic: e.target.value })}
                  placeholder="vehicle-alerts-abc123"
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Letters, numbers, _ and - only. Anyone with the topic name can read it on public servers — pick something unguessable.
                </p>
              </div>
              <div>
                <label className={labelCls}>Auth token (optional)</label>
                <input
                  type="password"
                  value={form.ntfyAuthToken}
                  onChange={(e) => setForm({ ...form, ntfyAuthToken: e.target.value })}
                  placeholder="tk_… (only for protected servers)"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Enabled
            </label>
            <button
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              role="switch"
              aria-checked={form.enabled}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors cursor-pointer focus:outline-none ${
                form.enabled
                  ? "bg-blue-600 border-blue-600"
                  : "bg-gray-200 dark:bg-gray-600 border-gray-200 dark:border-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                  form.enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSaving ? "Saving…" : isEditing ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
