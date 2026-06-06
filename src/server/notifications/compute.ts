import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

export type EventType = "tax" | "mot" | "insurance" | "service";

export interface ComputeVehicle {
  id: number;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  taxDueDate: string | null;
  motExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  serviceDate: string | null;
  manualSorn: boolean | null;
  taxStatus: string | null;
  archivedAt: string | null;
}

export interface ComputePreferences {
  enabled: boolean;
  leadDaysTax: string;
  leadDaysMot: string;
  leadDaysInsurance: string;
  leadDaysService: string;
}

export interface PlannedNotification {
  vehicleId: number;
  registrationNumber: string;
  displayName: string;
  eventType: EventType;
  eventDate: string;
  leadDays: number;
  daysUntilExpiry: number;
}

interface Inputs {
  vehicles: ComputeVehicle[];
  prefs: ComputePreferences;
  /** keys of `${vehicleId}|${eventType}|${eventDate}|${leadDays}` that have already been sent */
  alreadySent: Set<string>;
  now: Date;
}

const EVENT_FIELDS: Record<EventType, { field: keyof ComputeVehicle; skipIfSorn: boolean }> = {
  tax: { field: "taxDueDate", skipIfSorn: true },
  mot: { field: "motExpiryDate", skipIfSorn: false },
  insurance: { field: "insuranceExpiryDate", skipIfSorn: false },
  service: { field: "serviceDate", skipIfSorn: false },
};

const LEAD_KEY: Record<EventType, keyof Omit<ComputePreferences, "enabled">> = {
  tax: "leadDaysTax",
  mot: "leadDaysMot",
  insurance: "leadDaysInsurance",
  service: "leadDaysService",
};

function isSorn(v: ComputeVehicle): boolean {
  return !!(v.manualSorn || v.taxStatus?.toUpperCase() === "SORN");
}

export function parseLeadDays(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    const numbers = arr.filter(
      (x): x is number => typeof x === "number" && Number.isFinite(x) && Number.isInteger(x) && x >= 0
    );
    return [...new Set(numbers)].sort((a, b) => a - b); // smallest first
  } catch {
    return [];
  }
}

export function logKey(
  vehicleId: number,
  eventType: EventType,
  eventDate: string,
  leadDays: number
): string {
  return `${vehicleId}|${eventType}|${eventDate}|${leadDays}`;
}

export function notificationLogKey(row: {
  vehicleId: number;
  eventType: EventType;
  eventDate: string;
  leadDays: number;
}): string {
  return logKey(row.vehicleId, row.eventType, row.eventDate, row.leadDays);
}

export function computeNotificationsToSend({
  vehicles,
  prefs,
  alreadySent,
  now,
}: Inputs): PlannedNotification[] {
  if (!prefs.enabled) return [];

  const planned: PlannedNotification[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue;
    const sorn = isSorn(vehicle);
    const displayName = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.registrationNumber;

    for (const eventType of Object.keys(EVENT_FIELDS) as EventType[]) {
      const cfg = EVENT_FIELDS[eventType];
      if (cfg.skipIfSorn && sorn) continue;

      const dateStr = vehicle[cfg.field] as string | null;
      if (!dateStr) continue;
      const date = parseISO(dateStr);
      if (!isValid(date)) continue;

      const days = differenceInCalendarDays(date, now);
      const thresholds = parseLeadDays(prefs[LEAD_KEY[eventType]]);
      if (thresholds.length === 0) continue;

      // Pick the smallest threshold the event currently satisfies (days <= T).
      // This means a freshly-configured vehicle that's already overdue gets one
      // "0-day" notification rather than 30+7+0 backfires.
      const chosen = thresholds.find((t) => days <= t);
      if (chosen == null) continue;

      const key = logKey(vehicle.id, eventType, dateStr, chosen);
      if (alreadySent.has(key)) continue;

      planned.push({
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        displayName,
        eventType,
        eventDate: dateStr,
        leadDays: chosen,
        daysUntilExpiry: days,
      });
    }
  }

  return planned;
}

const EVENT_LABEL: Record<EventType, string> = {
  tax: "Road Tax",
  mot: "MOT",
  insurance: "Insurance",
  service: "Service",
};

/** Render a planned notification into a title + body. */
export function renderNotification(p: PlannedNotification): { title: string; body: string } {
  const label = EVENT_LABEL[p.eventType];
  const subject = `${p.registrationNumber} — ${label}`;
  let when: string;
  if (p.daysUntilExpiry < 0) {
    const n = Math.abs(p.daysUntilExpiry);
    when = `${n} day${n === 1 ? "" : "s"} overdue`;
  } else if (p.daysUntilExpiry === 0) {
    when = "expires today";
  } else {
    when = `${p.daysUntilExpiry} day${p.daysUntilExpiry === 1 ? "" : "s"} remaining`;
  }
  return {
    title: subject,
    body: `${p.displayName} — ${when} (due ${p.eventDate}).`,
  };
}
