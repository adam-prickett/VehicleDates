import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
}

function isDismissed(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (isNaN(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) {
      setDismissed(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setShowIos(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (isIos()) {
      setShowIos(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function handleInstall() {
    if (!event) return;
    event.prompt();
    event.userChoice.finally(() => {
      setEvent(null);
    });
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setDismissed(true);
    setEvent(null);
    setShowIos(false);
  }

  if (dismissed) return null;
  if (!event && !showIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none">
      <div className="mx-auto max-w-2xl pointer-events-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
          <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Install Vehicle Dates
          </p>
          {event ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Add to your home screen for a faster, full-screen experience.
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap{" "}
              <span className="inline-flex items-center align-middle px-1.5 py-0.5 mx-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium">
                Share
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="ml-1">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" />
                </svg>
              </span>{" "}
              then <span className="font-medium text-gray-700 dark:text-gray-200">Add to Home Screen</span>.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {event && (
              <button
                onClick={handleInstall}
                className="bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 cursor-pointer"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              {event ? "Not now" : "Got it"}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
