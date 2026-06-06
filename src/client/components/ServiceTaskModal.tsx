import { useEffect, useRef, useState } from "react";
import type { ServiceTask } from "../types.ts";

export const SERVICE_TYPE_PRESETS = [
  "Full Service",
  "Interim Service",
  "Oil Change",
  "Brake Pads",
  "Brake Discs",
  "Tyres",
  "Battery",
  "Air Filter",
  "Cabin Filter",
  "Spark Plugs",
  "Coolant Flush",
  "Cambelt",
  "Other",
];

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls =
  "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

export interface ServiceTaskPayload {
  type: string;
  date: string;
  mileage: number | null;
  cost: number | null;
  notes: string | null;
}

interface FormState {
  type: string;
  customType: string;
  date: string;
  mileage: string;
  cost: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    type: SERVICE_TYPE_PRESETS[0],
    customType: "",
    date: new Date().toISOString().slice(0, 10),
    mileage: "",
    cost: "",
    notes: "",
  };
}

function taskToForm(task: ServiceTask): FormState {
  const preset = SERVICE_TYPE_PRESETS.includes(task.type) ? task.type : "Other";
  return {
    type: preset,
    customType: preset === "Other" ? task.type : "",
    date: task.date,
    mileage: task.mileage?.toString() ?? "",
    cost: task.cost != null ? (task.cost / 100).toFixed(2) : "",
    notes: task.notes ?? "",
  };
}

interface ServiceTaskModalProps {
  task: ServiceTask | null; // null = new record
  onSave: (payload: ServiceTaskPayload) => void;
  onClose: () => void;
  isSaving?: boolean;
  error?: string | null;
}

export function ServiceTaskModal({
  task,
  onSave,
  onClose,
  isSaving,
  error,
}: ServiceTaskModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    task ? taskToForm(task) : emptyForm()
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
    const type = form.type === "Other" ? form.customType.trim() : form.type;
    if (!type || !form.date) return;

    const mileageNum = form.mileage.trim() ? parseInt(form.mileage) : null;
    const costPounds = form.cost.trim() ? parseFloat(form.cost) : null;
    const cost =
      costPounds != null && !isNaN(costPounds)
        ? Math.round(costPounds * 100)
        : null;

    onSave({
      type,
      date: form.date,
      mileage: mileageNum != null && !isNaN(mileageNum) ? mileageNum : null,
      cost,
      notes: form.notes.trim() || null,
    });
  }

  const isEditing = task != null;
  const heading = isEditing ? "Edit Service Record" : "New Service Record";

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
            <label className={labelCls}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={inputCls}
            >
              {SERVICE_TYPE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {form.type === "Other" && (
            <div>
              <label className={labelCls}>Custom Type</label>
              <input
                type="text"
                value={form.customType}
                onChange={(e) => setForm({ ...form, customType: e.target.value })}
                placeholder="e.g. Wiper Blades"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mileage</label>
              <input
                type="number"
                inputMode="numeric"
                value={form.mileage}
                onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                placeholder="e.g. 45000"
                min={0}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cost (£)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="e.g. 199.99"
                min={0}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Garage, parts replaced, etc."
              className={`${inputCls} resize-none`}
            />
          </div>
          {error && (
            <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
          )}
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
