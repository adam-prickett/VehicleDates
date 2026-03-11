import { useState, useEffect, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isValid,
} from "date-fns";

interface DatePickerModalProps {
  label: string;
  date: string | null;
  isDvlaField?: boolean;
  onSave: (date: string | null) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export function DatePickerModal({
  label,
  date,
  isDvlaField,
  onSave,
  onClose,
  isSaving,
}: DatePickerModalProps) {
  const initialDate = date && isValid(parseISO(date)) ? parseISO(date) : null;
  const [viewMonth, setViewMonth] = useState(initialDate ?? new Date());
  const [selected, setSelected] = useState<Date | null>(initialDate);
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  function handleSave() {
    onSave(selected ? format(selected, "yyyy-MM-dd") : null);
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 text-white px-5 py-4">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="font-bold text-lg">{label}</h2>
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
          <p className="text-blue-100 text-sm font-medium">
            {selected ? format(selected, "d MMMM yyyy") : "No date selected"}
          </p>
          {isDvlaField && (
            <p className="text-blue-200 text-xs mt-1">
              Normally set by DVLA — manual override
            </p>
          )}
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 cursor-pointer"
            aria-label="Previous month"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setViewMonth(new Date())}
            className="font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 cursor-pointer"
          >
            {format(viewMonth, "MMMM yyyy")}
          </button>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 cursor-pointer"
            aria-label="Next month"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="px-4 pb-2 pt-3">
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day) => {
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isTodayDay = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={`
                    aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-colors mx-auto w-9 h-9 cursor-pointer
                    ${!isCurrentMonth ? "text-gray-300 dark:text-gray-600" : ""}
                    ${isSelected
                      ? "bg-blue-600 text-white"
                      : isTodayDay && isCurrentMonth
                      ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700"
                      : isCurrentMonth
                      ? "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      : "hover:bg-gray-50 dark:hover:bg-gray-750"
                    }
                  `}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-5 pt-3">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={() => setViewMonth(new Date())}
            className="px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
          >
            Today
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
