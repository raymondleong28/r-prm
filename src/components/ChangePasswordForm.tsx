"use client";

import React, { useState } from "react";

/** Changes the signed-in user's password. Other signed-in sessions are signed out. */
export function ChangePasswordForm({ onToast }: { onToast: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 12) return setError("Use at least 12 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", currentPassword: current, newPassword: next }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Couldn't change your password.");
    setCurrent("");
    setNext("");
    setConfirm("");
    onToast("Password changed. Other devices have been signed out.");
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="font-bold text-slate-900">Change password</p>
      {error && <p className="p-2 rounded bg-red-50 border border-red-200 text-red-700 font-semibold">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          required
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className="px-3 py-2 border border-slate-300 rounded-lg"
        />
        <input
          required
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (12+ characters)"
          className="px-3 py-2 border border-slate-300 rounded-lg"
        />
        <input
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="px-3 py-2 border border-slate-300 rounded-lg"
        />
      </div>
      <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-blue-300">
        Update password
      </button>
    </form>
  );
}
