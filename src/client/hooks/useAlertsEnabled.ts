import { useEffect, useState } from "react";

const STORAGE_KEY = "alerts-enabled";
const EVENT_NAME = "alerts-enabled:change";

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true; // default: on
    return raw === "true";
  } catch {
    return true;
  }
}

/**
 * Per-device preference for whether dashboard expiry alerts are shown at all.
 * Persisted to localStorage; defaults to enabled. Components using the hook
 * stay in sync via a custom window event so a toggle on the Settings page is
 * reflected in real time on the dashboard.
 */
export function useAlertsEnabled() {
  const [enabled, setEnabled] = useState<boolean>(() => read());

  useEffect(() => {
    function refresh() {
      setEnabled(read());
    }
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function set(next: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore quota errors
    }
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT_NAME));
  }

  return { enabled, set, toggle: () => set(!enabled) };
}
