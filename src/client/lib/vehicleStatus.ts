import { differenceInDays, parseISO, isValid } from "date-fns";
import type { Vehicle } from "../types.ts";

export type VehicleStatus = "expired" | "warning" | "ok" | "unknown";

/**
 * Whether the vehicle should be treated as SORN — either manually marked, or
 * the DVLA-reported tax status equals "SORN".
 */
export function isSorn(vehicle: Vehicle): boolean {
  return !!(vehicle.manualSorn || vehicle.taxStatus?.toUpperCase() === "SORN");
}

/**
 * Worst-case status across the four tracked dates (Tax / MOT / Insurance /
 * Service). Tax is excluded when the vehicle is SORN. Returns "unknown" only
 * when no dates are recorded at all.
 */
export function getOverallStatus(vehicle: Vehicle): VehicleStatus {
  const sorn = isSorn(vehicle);
  const dates: Array<{ date: string | null; skip: boolean }> = [
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
    } catch {
      /* unparseable → ignore */
    }
  }

  if (hasWarning) return "warning";
  if (dates.some(({ date }) => date !== null)) return "ok";
  return "unknown";
}
