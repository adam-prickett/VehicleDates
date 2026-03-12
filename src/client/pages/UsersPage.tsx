import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../context/AuthContext.tsx";
import type { User } from "../types.ts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: () => api.users.create({ username, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onDone();
    },
    onError: (err) => setError((err as Error).message),
  });

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    createMutation.mutate();
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-600">
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Add User</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required className={inputCls} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")} className={inputCls}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className={inputCls} />
          <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onDone} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={createMutation.isPending} className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {createMutation.isPending ? "Adding..." : "Add User"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChangePasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.users.changePassword(user.id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onDone();
    },
    onError: (err) => setError((err as Error).message),
  });

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" minLength={8} required className={inputCls} />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm" required className={inputCls} />
      </div>
      {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 cursor-pointer">
          {mutation.isPending ? "Saving..." : "Save password"}
        </button>
      </div>
    </form>
  );
}

function UserRow({ user, currentUserId }: { user: User; currentUserId: number }) {
  const queryClient = useQueryClient();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.users.delete(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const isSelf = user.id === currentUserId;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-gray-100">{user.username}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border tracking-wide ${
              user.role === "admin"
                ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
            }`}>
              {user.role}
            </span>
            {isSelf && (
              <span className="text-xs text-gray-400 dark:text-gray-500">(you)</span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Added {formatDate(user.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowPasswordForm((v) => !v); setShowDeleteConfirm(false); }}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            Change password
          </button>
          {!isSelf && (
            <button
              onClick={() => { setShowDeleteConfirm((v) => !v); setShowPasswordForm(false); }}
              className="text-xs font-medium text-red-400 hover:text-red-600 cursor-pointer"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {showPasswordForm && (
        <ChangePasswordForm user={user} onDone={() => setShowPasswordForm(false)} />
      )}

      {showDeleteConfirm && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-400">Remove {user.username}?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">Cancel</button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer"
            >
              {deleteMutation.isPending ? "Removing..." : "Yes, remove"}
            </button>
          </div>
          {deleteMutation.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{(deleteMutation.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: api.users.list,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load users</p>
        <p className="text-red-500 text-sm mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">User Management</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        )}
      </div>

      {showAddForm && <AddUserForm onDone={() => setShowAddForm(false)} />}

      <div className="space-y-3">
        {users?.map((u) => (
          <UserRow key={u.id} user={u} currentUserId={currentUser!.id} />
        ))}
      </div>
    </div>
  );
}
