import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import type { ServiceTask } from "../types.ts";

const SERVICE_TYPE_PRESETS = [
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
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCost(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${(pence / 100).toFixed(2)}`;
}

export function ServiceTasksSection({ vehicleId }: { vehicleId: number }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryKey = ["service-tasks", vehicleId];

  const { data: tasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.serviceTasks.list(vehicleId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.serviceTasks.create>[1]) =>
      api.serviceTasks.create(vehicleId, data),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Parameters<typeof api.serviceTasks.update>[2] }) =>
      api.serviceTasks.update(vehicleId, taskId, data),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.serviceTasks.delete(vehicleId, taskId),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
    },
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function startEdit(task: ServiceTask) {
    setEditingId(task.id);
    setForm(taskToForm(task));
    setShowForm(true);
  }

  function handleSubmit() {
    const type = form.type === "Other" ? form.customType.trim() : form.type;
    if (!type || !form.date) return;

    const mileage = form.mileage.trim() ? parseInt(form.mileage) : null;
    const costPounds = form.cost.trim() ? parseFloat(form.cost) : null;
    const cost = costPounds != null && !isNaN(costPounds) ? Math.round(costPounds * 100) : null;

    const payload = {
      type,
      date: form.date,
      mileage: mileage != null && !isNaN(mileage) ? mileage : null,
      cost,
      notes: form.notes.trim() || null,
    };

    if (editingId != null) {
      updateMutation.mutate({ taskId: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const sorted = (tasks ?? [])
    .slice()
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : b.id - a.id));

  const mutating = createMutation.isPending || updateMutation.isPending;
  const error = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">Service History</h2>
        {!showForm && (
          <button
            onClick={startAdd}
            className="text-blue-600 text-sm font-medium hover:text-blue-800 cursor-pointer"
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {editingId != null ? "Edit Service Record" : "New Service Record"}
          </h3>
          <div>
            <label className={labelCls}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={inputCls}
            >
              {SERVICE_TYPE_PRESETS.map((t) => (
                <option key={t} value={t}>{t}</option>
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
              rows={2}
              placeholder="Garage, parts replaced, etc."
              className={`${inputCls} resize-none`}
            />
          </div>
          {error && (
            <p className="text-red-600 dark:text-red-400 text-xs">{error.message}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={closeForm}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutating}
              className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {mutating ? "Saving..." : editingId != null ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
      ) : sorted.length === 0 ? (
        !showForm && (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic text-center py-2">
            No service records yet. Tap Add to record one.
          </p>
        )
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {sorted.map((task) => (
            <li key={task.id} className="py-3 first:pt-0 last:pb-0">
              {deleteId === task.id ? (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-300 text-sm text-center mb-2">
                    Delete this service record?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(task.id)}
                      disabled={deleteMutation.isPending}
                      className="flex-1 bg-red-600 text-white font-semibold py-1.5 rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                        {task.type}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {formatDate(task.date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {task.mileage != null && (
                        <span>{task.mileage.toLocaleString()} mi</span>
                      )}
                      {task.cost != null && <span>{formatCost(task.cost)}</span>}
                    </div>
                    {task.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                        {task.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(task)}
                      className="text-blue-600 text-xs font-medium hover:text-blue-800 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(task.id)}
                      className="text-red-600 text-xs font-medium hover:text-red-800 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
