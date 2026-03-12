import { differenceInDays, parseISO, isValid } from "date-fns";

interface DateBadgeProps {
  label: string;
  date: string | null;
  status?: string | null;
  showStatus?: boolean;
  onClick?: () => void;
  sorn?: boolean;
}

function getUrgency(date: string | null): "expired" | "warning" | "ok" | "unknown" {
  if (!date) return "unknown";
  try {
    const d = parseISO(date);
    if (!isValid(d)) return "unknown";
    const days = differenceInDays(d, new Date());
    if (days < 0) return "expired";
    if (days <= 30) return "warning";
    return "ok";
  } catch {
    return "unknown";
  }
}

function formatDate(date: string | null): string {
  if (!date) return "Not set";
  try {
    const d = parseISO(date);
    if (!isValid(d)) return "Invalid date";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

function getDaysText(date: string | null): string {
  if (!date) return "";
  try {
    const d = parseISO(date);
    if (!isValid(d)) return "";
    const days = differenceInDays(d, new Date());
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    return `${days}d remaining`;
  } catch {
    return "";
  }
}

const urgencyStyles = {
  expired: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  ok: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300",
  unknown: "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400",
  sorn: "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
};

const dotStyles = {
  expired: "bg-red-500",
  warning: "bg-amber-500",
  ok: "bg-green-500",
  unknown: "bg-gray-400",
  sorn: "bg-purple-500",
};

export function DateBadge({ label, date, status, showStatus, onClick, sorn }: DateBadgeProps) {
  const urgency = sorn ? "sorn" : getUrgency(date);
  const daysText = sorn ? "" : getDaysText(date);

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg border p-3 text-left w-full ${urgencyStyles[urgency]} ${
        onClick
          ? "cursor-pointer hover:brightness-95 active:brightness-90 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {label}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onClick && (
            <svg
              className="w-3 h-3 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"
              />
            </svg>
          )}
          <span className={`h-2 w-2 rounded-full ${dotStyles[urgency]}`} />
        </div>
      </div>
      {sorn ? (
        <div className="mt-1 font-bold text-sm tracking-wide">SORN</div>
      ) : (
        <div className="mt-1 font-semibold text-sm">{formatDate(date)}</div>
      )}
      <div className={`text-xs mt-0.5 ${showStatus && status && !sorn ? "opacity-75" : "invisible"}`}>
        {showStatus && status && !sorn ? status : "\u00A0"}
      </div>
      <div className={`text-xs ${daysText ? "opacity-75" : "invisible"}`}>
        {daysText || "\u00A0"}
      </div>
    </Tag>
  );
}
