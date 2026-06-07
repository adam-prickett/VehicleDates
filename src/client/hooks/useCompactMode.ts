import { useEffect, useState } from "react";

const STORAGE_KEY = "compact-mode";
const EVENT_NAME = "compact-mode:change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Per-device preference for the dashboard's compact view (single-column
 * list, registration + status icon per row). Persisted to localStorage;
 * defaults to off. Components using the hook stay in sync via a custom
 * window event so the toggle reflects in real time across pages.
 */
export function useCompactMode() {
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
