import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";

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
              <p className="text-xs text-green-600 dark:text-green-500 font-mono mt-0.5">
                {showKey ? keyInfo.hint : keyInfo.hint?.replace(/●/g, "●")} &nbsp;
                <span className="text-xs text-green-600 dark:text-green-500">
                  via {keyInfo.source === "environment" ? ".env file" : "settings"}
                </span>
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

// --- Page ---

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
      <DvlaKeySection />
      <ExportSection />
      <ImportSection />
    </div>
  );
}
