import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

export function AddVehiclePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reg, setReg] = useState("");
  const [v5, setV5] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: api.vehicles.create,
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      navigate(`/vehicles/${vehicle.id}`);
    },
  });

  const formattedReg = reg.replace(/\s+/g, "").toUpperCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formattedReg) return;
    mutation.mutate({
      registrationNumber: formattedReg,
      v5DocumentNumber: v5 || undefined,
      model: model || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/vehicles" className="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add Vehicle</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls}>
              Registration Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="e.g. AB12 CDE"
              className={`${inputCls} text-lg font-bold tracking-widest uppercase`}
              maxLength={10}
              required
              autoFocus
              autoCapitalize="characters"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tax and MOT dates will be automatically fetched from the DVLA.
            </p>
          </div>

          <div>
            <label className={labelCls}>V5C Document Number</label>
            <input
              type="text"
              value={v5}
              onChange={(e) => setV5(e.target.value)}
              placeholder="e.g. 123456789"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Model <span className="text-gray-400 font-normal">(DVLA does not provide this)</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Golf GTI, 3 Series"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this vehicle..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {mutation.error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-700 dark:text-red-300 text-sm">
              {(mutation.error as Error).message}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              to="/vehicles"
              className="flex-1 text-center border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending || !formattedReg}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Adding...
                </>
              ) : (
                "Add Vehicle"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
