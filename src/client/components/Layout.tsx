import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../hooks/useTheme.ts";
import { api } from "../api.ts";

export function Layout() {
  const location = useLocation();
  const isAdd = location.pathname === "/vehicles/add";
  const isSettings = location.pathname === "/settings";
  const isListPage = location.pathname === "/vehicles";
  const { dark, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [refreshResult, setRefreshResult] = useState<{ success: number; failed: number } | null>(null);

  const refreshAllMutation = useMutation({
    mutationFn: api.vehicles.refreshAll,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setRefreshResult(result);
      setTimeout(() => setRefreshResult(null), 4000);
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-blue-700 dark:bg-blue-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/vehicles" className="flex items-center gap-2 cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
            <span className="hidden sm:inline font-bold text-lg tracking-tight">Vehicle Dates</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-800 transition-colors cursor-pointer"
            >
              {dark ? (
                // Sun icon
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                // Moon icon
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Refresh all from DVLA */}
            <button
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending}
              title="Refresh all vehicles from DVLA"
              className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg
                className={`w-[18px] h-[18px] ${refreshAllMutation.isPending ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Settings */}
            <Link
              to="/settings"
              title="Settings"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${isSettings ? "text-white bg-blue-600 dark:bg-blue-800" : "text-blue-200 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-800"}`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            {!isAdd && !isSettings && (
              <Link
                to="/vehicles/add"
                className="flex items-center gap-1.5 bg-white text-blue-700 font-semibold px-3 py-1.5 rounded-lg text-sm hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Vehicle</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Refresh result toast */}
      {refreshResult && (
        <div className={`text-center text-sm font-medium py-2 px-4 ${refreshResult.failed > 0 ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200" : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"}`}>
          {refreshResult.failed > 0
            ? `DVLA refresh: ${refreshResult.success} updated, ${refreshResult.failed} failed`
            : `DVLA refresh complete — ${refreshResult.success} vehicle${refreshResult.success !== 1 ? "s" : ""} updated`}
        </div>
      )}

      <main className={`flex-1 w-full px-4 py-6 mx-auto ${isListPage ? "max-w-full" : "max-w-2xl"}`}>
        <Outlet />
      </main>
    </div>
  );
}
