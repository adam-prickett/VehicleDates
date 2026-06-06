import { useEffect, useRef, useState } from "react";
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

const SWIPE_OPEN_PX = 88;
const SWIPE_COMMIT_PX = 40;

interface RowProps {
  task: ServiceTask;
  isOpen: boolean;
  isDeleting: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SwipeableServiceRow({
  task,
  isOpen,
  isDeleting,
  onOpen,
  onClose,
  onEdit,
  onDelete,
}: RowProps) {
  const [dragDelta, setDragDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const direction = useRef<"horizontal" | "vertical" | null>(null);

  // Snap closed if parent flips isOpen off
  useEffect(() => {
    if (!isOpen) setDragDelta(0);
  }, [isOpen]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    direction.current = null;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      direction.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (direction.current === "horizontal") {
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        // Vertical scroll wins — abort this gesture
        setDragging(false);
        return;
      }
    }

    const base = isOpen ? -SWIPE_OPEN_PX : 0;
    setDragDelta(Math.max(-SWIPE_OPEN_PX * 1.25, Math.min(0, base + dx)));
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (direction.current === "horizontal") {
      const shouldBeOpen = isOpen
        ? dragDelta < -SWIPE_OPEN_PX + SWIPE_COMMIT_PX
        : dragDelta < -SWIPE_COMMIT_PX;
      if (shouldBeOpen) onOpen();
      else onClose();
    }
    setDragDelta(0);
    direction.current = null;
  }

  const offset = dragging ? dragDelta : isOpen ? -SWIPE_OPEN_PX : 0;

  function handleRowClick() {
    // Tapping the open row closes it without firing edit
    if (isOpen) onClose();
  }

  return (
    <li className="py-0 first:pt-0 last:pb-0" data-row-id={task.id}>
      <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
        {/* Delete action revealed behind the row */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          aria-label="Delete service record"
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center font-semibold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-70 cursor-pointer"
          style={{ width: SWIPE_OPEN_PX }}
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" strokeOpacity="0.3" />
              <path strokeLinecap="round" strokeWidth="2" d="M21 12a9 9 0 00-9-9" />
            </svg>
          ) : (
            "Delete"
          )}
        </button>

        {/* Foreground row content */}
        <div
          className="relative bg-white dark:bg-gray-800 py-3 px-5"
          style={{
            transform: `translateX(${offset}px)`,
            transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleRowClick}
        >
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
                {task.mileage != null && <span>{task.mileage.toLocaleString()} mi</span>}
                {task.cost != null && <span>{formatCost(task.cost)}</span>}
              </div>
              {task.notes && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  {task.notes}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="Edit service record"
              className="flex-shrink-0 p-1.5 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ServiceTasksSection({ vehicleId }: { vehicleId: number }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<EditTarget>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

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
      setOpenRowId(null);
    },
  });

  function handleSave(payload: ServiceTaskPayload) {
    if (target && target !== "new") {
      updateMutation.mutate({ taskId: target.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Close any open swipe-row when the user taps outside it
  useEffect(() => {
    if (openRowId == null) return;
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      const row = target?.closest("[data-row-id]");
      if (row?.getAttribute("data-row-id") === String(openRowId)) return;
      setOpenRowId(null);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [openRowId]);

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
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-5">
          {sorted.map((task) => (
            <SwipeableServiceRow
              key={task.id}
              task={task}
              isOpen={openRowId === task.id}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === task.id}
              onOpen={() => setOpenRowId(task.id)}
              onClose={() => setOpenRowId((prev) => (prev === task.id ? null : prev))}
              onEdit={() => setTarget(task)}
              onDelete={() => deleteMutation.mutate(task.id)}
            />
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
