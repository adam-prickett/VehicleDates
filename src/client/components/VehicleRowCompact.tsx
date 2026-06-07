import { Link } from "react-router-dom";
import type { Vehicle } from "../types.ts";
import { RegistrationPlate } from "./RegistrationPlate.tsx";
import { getOverallStatus, isSorn, type VehicleStatus } from "../lib/vehicleStatus.ts";

interface Props {
  vehicle: Vehicle;
  archived?: boolean;
}

function StatusIcon({ status, archived }: { status: VehicleStatus; archived?: boolean }) {
  if (archived) {
    return (
      <svg
        className="w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-label="Archived"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M7 8v11a2 2 0 002 2h6a2 2 0 002-2V8M10 12h4" />
      </svg>
    );
  }
  switch (status) {
    case "expired":
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Expired">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case "warning":
      return (
        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Expiring soon">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
      );
    case "ok":
      return (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-label="OK">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case "unknown":
    default:
      return (
        <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20" aria-label="No dates recorded">
          <path d="M5 9a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" />
        </svg>
      );
  }
}

export function VehicleRowCompact({ vehicle, archived }: Props) {
  const status = archived ? "unknown" : getOverallStatus(vehicle);
  const sorn = isSorn(vehicle);

  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
        archived
          ? "bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900"
          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60"
      }`}
    >
      <RegistrationPlate registration={vehicle.registrationNumber} size="sm" />

      {archived && vehicle.archiveReason && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {vehicle.archiveReason}
        </span>
      )}
      {!archived && sorn && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 uppercase tracking-wide">
          SORN
        </span>
      )}

      <div className="flex-1" />

      <StatusIcon status={status} archived={archived} />

      <svg
        className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
