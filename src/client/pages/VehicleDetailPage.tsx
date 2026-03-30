import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { DateBadge } from "../components/DateBadge.tsx";
import { DatePickerModal } from "../components/DatePickerModal.tsx";
import { RegistrationPlate } from "../components/RegistrationPlate.tsx";
import { DrivingAnimation } from "../components/DrivingAnimation.tsx";
import type { Vehicle } from "../types.ts";

type DateField = "taxDueDate" | "motExpiryDate" | "insuranceExpiryDate" | "serviceDate";

const DATE_FIELD_LABELS: Record<DateField, string> = {
  taxDueDate: "Road Tax Expiry",
  motExpiryDate: "MOT Expiry",
  insuranceExpiryDate: "Insurance Expiry",
  serviceDate: "Next Service",
};

const DVLA_FIELDS = new Set<DateField>(["taxDueDate", "motExpiryDate"]);

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";
const legendCls = "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2";

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 text-right ml-4">{value}</span>
    </div>
  );
}

interface EditState {
  make: string;
  model: string;
  colour: string;
  v5DocumentNumber: string;
  insuranceExpiryDate: string;
  insuranceProvider: string;
  serviceDate: string;
  serviceIntervalMonths: string;
  notes: string;
}

function toEditState(v: Vehicle): EditState {
  return {
    make: v.make ?? "",
    model: v.model ?? "",
    colour: v.colour ?? "",
    v5DocumentNumber: v.v5DocumentNumber ?? "",
    insuranceExpiryDate: v.insuranceExpiryDate ?? "",
    insuranceProvider: v.insuranceProvider ?? "",
    serviceDate: v.serviceDate ?? "",
    serviceIntervalMonths: v.serviceIntervalMonths?.toString() ?? "",
    notes: v.notes ?? "",
  };
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = parseInt(id!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveReason, setArchiveReason] = useState<"sold" | "scrapped" | "other">("sold");
  const [archiveSaleDate, setArchiveSaleDate] = useState("");
  const [archiveBuyerName, setArchiveBuyerName] = useState("");
  const [archiveBuyerContact, setArchiveBuyerContact] = useState("");
  const [datePickerField, setDatePickerField] = useState<DateField | null>(null);

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicles", vehicleId],
    queryFn: () => api.vehicles.get(vehicleId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.vehicles.update>[1]) =>
      api.vehicles.update(vehicleId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicles", vehicleId], updated);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.vehicles.delete(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      navigate("/vehicles");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.vehicles.archive>[1]) =>
      api.vehicles.archive(vehicleId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicles", vehicleId], updated);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setShowArchiveForm(false);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => api.vehicles.unarchive(vehicleId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicles", vehicleId], updated);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      Promise.all([api.vehicles.refresh(vehicleId), new Promise((r) => setTimeout(r, 2000))]).then(
        ([result]) => result as Awaited<ReturnType<typeof api.vehicles.refresh>>
      ),
    onSuccess: ({ vehicle: updated }) => {
      queryClient.setQueryData(["vehicles", vehicleId], updated);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const quickDateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.vehicles.update>[1]) =>
      api.vehicles.update(vehicleId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicles", vehicleId], updated);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDatePickerField(null);
    },
  });

  function startEdit() {
    if (vehicle) {
      setEditState(toEditState(vehicle));
      setIsEditing(true);
    }
  }

  function handleSave() {
    if (!editState) return;
    updateMutation.mutate({
      make: editState.make || null,
      model: editState.model || null,
      colour: editState.colour || null,
      v5DocumentNumber: editState.v5DocumentNumber || null,
      insuranceExpiryDate: editState.insuranceExpiryDate || null,
      insuranceProvider: editState.insuranceProvider || null,
      serviceDate: editState.serviceDate || null,
      serviceIntervalMonths: editState.serviceIntervalMonths
        ? parseInt(editState.serviceIntervalMonths)
        : null,
      notes: editState.notes || null,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-700 dark:text-red-300 font-medium">Vehicle not found</p>
        <Link to="/vehicles" className="text-blue-600 text-sm mt-2 inline-block cursor-pointer">
          Back to vehicles
        </Link>
      </div>
    );
  }

  const displayName = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown vehicle";
  const sorn = !!(vehicle.manualSorn || vehicle.taxStatus?.toUpperCase() === "SORN");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/vehicles" className="text-blue-600 hover:text-blue-800 cursor-pointer">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <RegistrationPlate registration={vehicle.registrationNumber} size="md" />
            {sorn && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 tracking-wide">
                SORN
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{displayName}</p>
        </div>
      </div>

      {/* Archived Banner */}
      {vehicle.archivedAt && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 tracking-wide uppercase">
                  Archived
                </span>
                {vehicle.archiveReason && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{vehicle.archiveReason}</span>
                )}
              </div>
              {vehicle.archiveReason === "sold" && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  {vehicle.saleDate && <p>Sold: {vehicle.saleDate}</p>}
                  {vehicle.buyerName && <p>Buyer: {vehicle.buyerName}</p>}
                  {vehicle.buyerContact && <p>Contact: {vehicle.buyerContact}</p>}
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                Archived {formatDateTime(vehicle.archivedAt)}
              </p>
            </div>
            <button
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {unarchiveMutation.isPending ? "Restoring..." : "Restore"}
            </button>
          </div>
        </div>
      )}

      {/* Dates Grid */}
      <div className="grid grid-cols-2 gap-3">
        <DateBadge
          label="Road Tax"
          date={vehicle.taxDueDate}
          status={vehicle.taxStatus}
          showStatus={!sorn}
          sorn={sorn}
          onClick={() => setDatePickerField("taxDueDate")}
        />
        <DateBadge
          label="MOT"
          date={vehicle.motExpiryDate}
          status={vehicle.motStatus}
          showStatus
          onClick={() => setDatePickerField("motExpiryDate")}
        />
        <DateBadge
          label="Insurance"
          date={vehicle.insuranceExpiryDate}
          onClick={() => setDatePickerField("insuranceExpiryDate")}
        />
        <DateBadge
          label="Service"
          date={vehicle.serviceDate}
          onClick={() => setDatePickerField("serviceDate")}
        />
      </div>

      {/* Date Picker Modal */}
      {datePickerField && (
        <DatePickerModal
          label={DATE_FIELD_LABELS[datePickerField]}
          date={vehicle[datePickerField]}
          isDvlaField={DVLA_FIELDS.has(datePickerField)}
          isSaving={quickDateMutation.isPending}
          onSave={(newDate) =>
            quickDateMutation.mutate({ [datePickerField]: newDate })
          }
          onClose={() => setDatePickerField(null)}
          {...(datePickerField === "taxDueDate" && {
            isSorn: sorn,
            onToggleSorn: () => updateMutation.mutate({ manualSorn: !vehicle.manualSorn }),
          })}
        />
      )}

      {/* DVLA Refresh */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">DVLA Data</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Last updated: {formatDateTime(vehicle.dvlaLastRefreshed)}
            </p>
          </div>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold px-3 py-2 rounded-lg text-sm hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-50 transition-colors flex-shrink-0 cursor-pointer"
          >
            <svg
              className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshMutation.isPending ? "Refreshing..." : "Refresh from DVLA"}
          </button>
        </div>
        <a
          href={`https://www.check-mot.service.gov.uk/results?registration=${encodeURIComponent(vehicle.registrationNumber)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          View MOT History
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="ml-auto opacity-50">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        {refreshMutation.isPending && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <DrivingAnimation />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1.5">
              Fetching DVLA data…
            </p>
          </div>
        )}
        {refreshMutation.error && (
          <p className="text-red-600 dark:text-red-400 text-xs mt-2">
            {(refreshMutation.error as Error).message}
          </p>
        )}
        {refreshMutation.isSuccess && !refreshMutation.data.found && (
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
            Vehicle not found in DVLA records. DVLA data may be unavailable.
          </p>
        )}
        {refreshMutation.isSuccess && refreshMutation.data.found && (
          <p className="text-green-600 dark:text-green-400 text-xs mt-2">DVLA data updated successfully.</p>
        )}
      </div>

      {/* Vehicle Details */}
      {isEditing && editState ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Edit Details</h2>

          <fieldset className="space-y-3">
            <legend className={legendCls}>Vehicle Info</legend>
            <div>
              <label className={labelCls}>Make <span className="text-gray-400 font-normal">(overrides DVLA)</span></label>
              <input type="text" value={editState.make} onChange={(e) => setEditState({ ...editState, make: e.target.value })} placeholder="e.g. Volkswagen" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Model</label>
              <input type="text" value={editState.model} onChange={(e) => setEditState({ ...editState, model: e.target.value })} placeholder="e.g. Golf GTI" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Colour <span className="text-gray-400 font-normal">(overrides DVLA)</span></label>
              <input type="text" value={editState.colour} onChange={(e) => setEditState({ ...editState, colour: e.target.value })} placeholder="e.g. Metallic Blue" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>V5C Document Number</label>
              <input type="text" value={editState.v5DocumentNumber} onChange={(e) => setEditState({ ...editState, v5DocumentNumber: e.target.value })} placeholder="e.g. 123456789" className={inputCls} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={legendCls}>Insurance</legend>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" value={editState.insuranceExpiryDate} onChange={(e) => setEditState({ ...editState, insuranceExpiryDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provider</label>
              <input type="text" value={editState.insuranceProvider} onChange={(e) => setEditState({ ...editState, insuranceProvider: e.target.value })} placeholder="e.g. Admiral, Direct Line" className={inputCls} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={legendCls}>Service</legend>
            <div>
              <label className={labelCls}>Next Service Date</label>
              <input type="date" value={editState.serviceDate} onChange={(e) => setEditState({ ...editState, serviceDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Service Interval (months)</label>
              <input type="number" value={editState.serviceIntervalMonths} onChange={(e) => setEditState({ ...editState, serviceIntervalMonths: e.target.value })} placeholder="e.g. 12" min={1} max={36} className={inputCls} />
            </div>
          </fieldset>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={editState.notes} onChange={(e) => setEditState({ ...editState, notes: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
          </div>

          {updateMutation.error && (
            <p className="text-red-600 dark:text-red-400 text-sm">{(updateMutation.error as Error).message}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setIsEditing(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm cursor-pointer">
              Cancel
            </button>
            <button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm cursor-pointer">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Vehicle Details</h2>
            <button onClick={startEdit} className="text-blue-600 text-sm font-medium hover:text-blue-800 cursor-pointer">
              Edit
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="Make" value={vehicle.make} />
            <InfoRow label="Model" value={vehicle.model} />
            <InfoRow label="Colour" value={vehicle.colour} />
            <InfoRow label="Year" value={vehicle.yearOfManufacture} />
            <InfoRow label="Fuel Type" value={vehicle.fuelType} />
            <InfoRow label="Engine Capacity" value={vehicle.engineCapacity ? `${vehicle.engineCapacity}cc` : null} />
            <InfoRow label="CO2 Emissions" value={vehicle.co2Emissions ? `${vehicle.co2Emissions}g/km` : null} />
            <InfoRow label="V5C Document Number" value={vehicle.v5DocumentNumber} />
            <InfoRow label="V5C Last Issued" value={vehicle.dateOfLastV5CIssued} />
            <InfoRow label="Insurance Provider" value={vehicle.insuranceProvider} />
            <InfoRow label="Service Interval" value={vehicle.serviceIntervalMonths ? `Every ${vehicle.serviceIntervalMonths} months` : null} />
            {vehicle.notes && (
              <div className="py-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{vehicle.notes}</p>
              </div>
            )}
          </div>

          {!vehicle.make && !vehicle.model && !vehicle.colour && !vehicle.v5DocumentNumber && (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic text-center py-2">
              No details recorded yet. Tap Edit to add details.
            </p>
          )}
        </div>
      )}

      {/* Archive */}
      {!vehicle.archivedAt && (
        <div>
          {!showArchiveForm ? (
            <button
              onClick={() => setShowArchiveForm(true)}
              className="w-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm cursor-pointer"
            >
              Archive Vehicle
            </button>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Archive Vehicle</h3>
              <div>
                <label className={labelCls}>Reason</label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value as "sold" | "scrapped" | "other")}
                  className={inputCls}
                >
                  <option value="sold">Sold</option>
                  <option value="scrapped">Scrapped</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {archiveReason === "sold" && (
                <>
                  <div>
                    <label className={labelCls}>Sale Date</label>
                    <input type="date" value={archiveSaleDate} onChange={(e) => setArchiveSaleDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Buyer Name</label>
                    <input type="text" value={archiveBuyerName} onChange={(e) => setArchiveBuyerName(e.target.value)} placeholder="e.g. John Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Buyer Contact</label>
                    <input type="text" value={archiveBuyerContact} onChange={(e) => setArchiveBuyerContact(e.target.value)} placeholder="Phone, email or address" className={inputCls} />
                  </div>
                </>
              )}
              {archiveMutation.error && (
                <p className="text-red-600 dark:text-red-400 text-sm">{(archiveMutation.error as Error).message}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowArchiveForm(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={() => archiveMutation.mutate({
                    reason: archiveReason,
                    saleDate: archiveReason === "sold" ? (archiveSaleDate || null) : null,
                    buyerName: archiveReason === "sold" ? (archiveBuyerName || null) : null,
                    buyerContact: archiveReason === "sold" ? (archiveBuyerContact || null) : null,
                  })}
                  disabled={archiveMutation.isPending}
                  className="flex-1 bg-gray-600 dark:bg-gray-500 text-white font-semibold py-2 rounded-lg text-sm hover:bg-gray-700 dark:hover:bg-gray-400 disabled:opacity-50 cursor-pointer"
                >
                  {archiveMutation.isPending ? "Archiving..." : "Archive Vehicle"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="pb-4">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm cursor-pointer"
          >
            Remove Vehicle
          </button>
        ) : (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-300 font-medium text-sm text-center mb-3">
              Remove {vehicle.registrationNumber}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm cursor-pointer">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                {deleteMutation.isPending ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
