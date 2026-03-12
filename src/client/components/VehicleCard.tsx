import { Link } from "react-router-dom";
import type { Vehicle } from "../types.ts";
import { DateBadge } from "./DateBadge.tsx";
import { RegistrationPlate } from "./RegistrationPlate.tsx";
import { differenceInDays, parseISO, isValid } from "date-fns";

function isSorn(vehicle: Vehicle): boolean {
  return !!(vehicle.manualSorn || vehicle.taxStatus?.toUpperCase() === "SORN");
}

function getOverallStatus(vehicle: Vehicle): "expired" | "warning" | "ok" | "unknown" {
  const sorn = isSorn(vehicle);
  const dates = [
    { date: vehicle.taxDueDate, skip: sorn },
    { date: vehicle.motExpiryDate, skip: false },
    { date: vehicle.insuranceExpiryDate, skip: false },
    { date: vehicle.serviceDate, skip: false },
  ];

  let hasWarning = false;
  for (const { date, skip } of dates) {
    if (!date || skip) continue;
    try {
      const parsed = parseISO(date);
      if (!isValid(parsed)) continue;
      const days = differenceInDays(parsed, new Date());
      if (days < 0) return "expired";
      if (days <= 30) hasWarning = true;
    } catch {}
  }

  if (hasWarning) return "warning";
  if (dates.some(({ date }) => date !== null)) return "ok";
  return "unknown";
}

const statusBanner = {
  expired: "border-l-4 border-red-500",
  warning: "border-l-4 border-amber-400",
  ok: "border-l-4 border-green-500",
  unknown: "border-l-4 border-gray-300",
};

interface VehicleCardProps {
  vehicle: Vehicle;
  archived?: boolean;
}

export function VehicleCard({ vehicle, archived }: VehicleCardProps) {
  const status = getOverallStatus(vehicle);
  const sorn = isSorn(vehicle);

  return (
    <Link to={`/vehicles/${vehicle.id}`} className="block group h-full cursor-pointer">
      <div
        className={`rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 h-full flex flex-col ${archived ? "bg-gray-50 dark:bg-gray-900 opacity-75" : "bg-white dark:bg-gray-800"} ${statusBanner[archived ? "unknown" : status]}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3 flex-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <RegistrationPlate registration={vehicle.registrationNumber} size="sm" />
              {archived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 tracking-wide uppercase">
                  {vehicle.archiveReason ?? "Archived"}
                </span>
              )}
              {!archived && sorn && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 tracking-wide">
                  SORN
                </span>
              )}
            </div>
            <div className="mt-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {[vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(" ") || (
                <span className="text-gray-400 dark:text-gray-500 italic">Unknown vehicle</span>
              )}
            </div>
            {vehicle.yearOfManufacture && (
              <div className="text-xs text-gray-400 dark:text-gray-500">{vehicle.yearOfManufacture}</div>
            )}
          </div>
          <svg
            className="text-gray-300 group-hover:text-blue-400 transition-colors mt-1 flex-shrink-0"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DateBadge
            label="Tax"
            date={vehicle.taxDueDate}
            status={vehicle.taxStatus}
            showStatus={!sorn}
            sorn={sorn}
          />
          <DateBadge
            label="MOT"
            date={vehicle.motExpiryDate}
            status={vehicle.motStatus}
            showStatus
          />
          <DateBadge label="Insurance" date={vehicle.insuranceExpiryDate} />
          <DateBadge label="Service" date={vehicle.serviceDate} />
        </div>
      </div>
    </Link>
  );
}
