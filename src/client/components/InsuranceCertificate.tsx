import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import type { Vehicle } from "../types.ts";

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/heic,image/heif";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploaded(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function InsuranceCertificate({ vehicle }: { vehicle: Vehicle }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateCache = (updated: Vehicle) => {
    queryClient.setQueryData(["vehicles", vehicle.id], updated);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.insurance.uploadCertificate(vehicle.id, file),
    onSuccess: updateCache,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.insurance.deleteCertificate(vehicle.id),
    onSuccess: (updated) => {
      updateCache(updated);
      setConfirmDelete(false);
    },
  });

  function pickFile() {
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadMutation.mutate(file);
  }

  const hasCertificate = !!vehicle.insuranceCertificateFilename;
  const error = (uploadMutation.error || deleteMutation.error) as Error | null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFile}
        className="hidden"
      />

      {hasCertificate ? (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={api.insurance.certificateUrl(vehicle.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline truncate block"
              >
                {vehicle.insuranceCertificateOriginalName ?? "Certificate"}
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatSize(vehicle.insuranceCertificateSize)}
                {vehicle.insuranceCertificateUploadedAt && (
                  <>
                    {" · uploaded "}
                    {formatUploaded(vehicle.insuranceCertificateUploadedAt)}
                  </>
                )}
              </p>
            </div>
          </div>

          {!confirmDelete ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={pickFile}
                disabled={uploadMutation.isPending}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
              >
                {uploadMutation.isPending ? "Uploading..." : "Replace"}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium px-3 py-1.5 rounded-lg text-xs hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-3">
              <p className="text-red-800 dark:text-red-300 text-xs text-center mb-2">
                Remove certificate?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-1.5 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-red-600 text-white font-semibold py-1.5 rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {deleteMutation.isPending ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={pickFile}
          disabled={uploadMutation.isPending}
          className="w-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-medium py-3 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {uploadMutation.isPending ? "Uploading..." : "Upload Insurance Certificate"}
        </button>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error.message}</p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        PDF, JPEG, PNG or HEIC. Max 10 MB.
      </p>
    </div>
  );
}
