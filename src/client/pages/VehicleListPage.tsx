import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { api } from "../api.ts";
import { VehicleCard } from "../components/VehicleCard.tsx";
import type { Vehicle } from "../types.ts";

const WARN_DAYS = 30;
const CRITICAL_DAYS = 7;

interface Alert {
  vehicleId: number;
  reg: string;
  label: string;
  days: number; // negative = overdue
}

const DATE_FIELDS: { key: keyof Vehicle; label: string; skipIfSorn?: boolean }[] = [
  { key: "taxDueDate", label: "Road Tax", skipIfSorn: true },
  { key: "motExpiryDate", label: "MOT" },
  { key: "insuranceExpiryDate", label: "Insurance" },
  { key: "serviceDate", label: "Service" },
];

function isVehicleSorn(v: Vehicle): boolean {
  return !!(v.manualSorn || v.taxStatus?.toUpperCase() === "SORN");
}

function getAlerts(vehicles: Vehicle[]): Alert[] {
  const alerts: Alert[] = [];
  for (const v of vehicles) {
    const sorn = isVehicleSorn(v);
    for (const { key, label, skipIfSorn } of DATE_FIELDS) {
      if (skipIfSorn && sorn) continue;
      const date = v[key] as string | null;
      if (!date) continue;
      try {
        const d = parseISO(date);
        if (!isValid(d)) continue;
        const days = differenceInDays(d, new Date());
        if (days <= WARN_DAYS) {
          alerts.push({ vehicleId: v.id, reg: v.registrationNumber, label, days });
        }
      } catch {}
    }
  }
  // expired first, then soonest
  return alerts.sort((a, b) => a.days - b.days);
}

function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(`${a.vehicleId}-${a.label}`));
  if (visible.length === 0) return null;

  function dismiss(a: Alert) {
    setDismissed((prev) => new Set(prev).add(`${a.vehicleId}-${a.label}`));
  }

  return (
    <div className="space-y-2 mb-5">
      {visible.map((a) => {
        const overdue = a.days < 0;
        const critical = a.days >= 0 && a.days <= CRITICAL_DAYS;
        const warning = a.days > CRITICAL_DAYS;

        const styles = overdue
          ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
          : critical
          ? "bg-orange-50 border-orange-300 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300"
          : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300";

        const icon = overdue ? (
          // X circle
          <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : critical ? (
          // Warning triangle
          <svg className="w-5 h-5 flex-shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        ) : (
          // Info circle
          <svg className="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );

        const daysText = overdue
          ? `${Math.abs(a.days)} day${Math.abs(a.days) !== 1 ? "s" : ""} overdue`
          : a.days === 0
          ? "expires today"
          : `${a.days} day${a.days !== 1 ? "s" : ""} remaining`;

        return (
          <Link
            key={`${a.vehicleId}-${a.label}`}
            to={`/vehicles/${a.vehicleId}`}
            className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${styles} hover:brightness-95 transition-all cursor-pointer`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <span className="font-bold">{a.reg}</span>
              <span className="font-medium"> — {a.label} </span>
              <span className="opacity-80">{daysText}</span>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); dismiss(a); }}
              className="flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity p-1 -mr-1"
              aria-label="Dismiss"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Link>
        );
      })}
    </div>
  );
}

export function VehicleListPage() {
  const { data: vehicles, isLoading, error } = useQuery({
    queryKey: ["vehicles"],
    queryFn: api.vehicles.list,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load vehicles</p>
        <p className="text-red-500 text-sm mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto mb-4 text-gray-300" width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-500 mb-2">No vehicles yet</h2>
        <p className="text-gray-400 mb-6">Add your first vehicle to get started</p>
        <Link
          to="/vehicles/add"
          className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add your first vehicle
        </Link>
      </div>
    );
  }

  const sorted = [...vehicles].sort((a, b) =>
    a.registrationNumber.localeCompare(b.registrationNumber)
  );

  const alerts = getAlerts(vehicles);

  return (
    <div>
      <AlertBanner alerts={alerts} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
}
