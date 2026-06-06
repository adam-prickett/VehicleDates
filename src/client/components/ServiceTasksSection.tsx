import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import type { ServiceTask } from "../types.ts";
import { ServiceTaskModal, type ServiceTaskPayload } from "./ServiceTaskModal.tsx";

type EditTarget = ServiceTask | "new" | null;

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
  const [target, setTarget] = useState<EditTarget>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryKey = ["service-tasks", vehicleId];

  const { data: tasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.serviceTasks.list(vehicleId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (data: ServiceTaskPayload) => api.serviceTasks.create(vehicleId, data),
    onSuccess: () => {
      invalidate();
      setTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: ServiceTaskPayload }) =>
      api.serviceTasks.update(vehicleId, taskId, data),
    onSuccess: () => {
      invalidate();
      setTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.serviceTasks.delete(vehicleId, taskId),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
    },
  });

  function handleSave(payload: ServiceTaskPayload) {
    if (target && target !== "new") {
      updateMutation.mutate({ taskId: target.id, data: payload });
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
        <button
          onClick={() => setTarget("new")}
          className="text-blue-600 text-sm font-medium hover:text-blue-800 cursor-pointer"
        >
          + Add
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm italic text-center py-2">
          No service records yet. Tap Add to record one.
        </p>
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
                      onClick={() => setTarget(task)}
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

      {target && (
        <ServiceTaskModal
          task={target === "new" ? null : target}
          onSave={handleSave}
          onClose={() => setTarget(null)}
          isSaving={mutating}
          error={error?.message ?? null}
        />
      )}
    </div>
  );
}
