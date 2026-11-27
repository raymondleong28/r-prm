"use client";

import React, { useState } from "react";
import {
  MfaSetupPanel,
  RecoveryCodesPanel,
  type MfaEnrollmentView,
} from "@/components/MfaPanels";

type Props = {
  email: string;
  enrolled: boolean;
  requiredForMe: boolean;
  onChanged: () => Promise<void> | void;
  onToast: (message: string) => void;
};

async function postAuth(body: Record<string, unknown>) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** The signed-in user's own two-step login: set up, confirm, new recovery codes, turn off. */
export function AccountMfaSection({ email, enrolled, requiredForMe, onChanged, onToast }: Props) {
  const [setup, setSetup] = useState<MfaEnrollmentView | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "regenerate" | "disable">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSetup(null);
    setCode("");
    setMode("idle");
    setError(null);
  };

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    const { ok, json } = await postAuth({ action: "enroll_mfa" });
    setBusy(false);
    if (ok && json.enrollment) setSetup(json.enrollment);
    else setError(json.error || "Couldn't start setup");
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, json } = await postAuth({ action: "confirm_mfa", code });
    setBusy(false);
    if (ok && Array.isArray(json.recoveryCodes)) {
      setCodes(json.recoveryCodes);
      setSetup(null);
      setCode("");
      onToast("Two-step login is on");
      await onChanged();
    } else {
      setError(json.error || "That code didn't match");
    }
  };

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, json } = await postAuth({ action: "regenerate_recovery_codes", code });
    setBusy(false);
    if (ok && Array.isArray(json.recoveryCodes)) {
      setCodes(json.recoveryCodes);
      reset();
      onToast("New recovery codes issued. The old ones no longer work.");
    } else {
      setError(json.error || "Couldn't issue new codes");
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    const { ok, json } = await postAuth({ action: "disable_mfa" });
    setBusy(false);
    if (ok) {
      reset();
      onToast("Two-step login turned off");
      await onChanged();
    } else {
      setError(json.error || "Couldn't turn off two-step login");
    }
  };

  return (
    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">Your two-step login ({email})</h3>
          <p className="text-slate-600">
            {enrolled
              ? "On. You'll enter a code from your authenticator app when you sign in."
              : requiredForMe
                ? "Required by your workspace. You'll be asked to set it up at your next sign-in."
                : "Off. Turn it on to protect your account with an authenticator app."}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
            enrolled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {enrolled ? "On" : "Off"}
        </span>
      </div>

      {error && (
        <p className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">{error}</p>
      )}

      {codes && (
        <RecoveryCodesPanel codes={codes} continueLabel="Done" onContinue={() => setCodes(null)} />
      )}

      {!codes && !enrolled && !setup && (
        <button
          type="button"
          disabled={busy}
          onClick={startSetup}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold"
        >
          Set up two-step login
        </button>
      )}

      {!codes && setup && (
        <form onSubmit={confirmSetup} className="space-y-3">
          <MfaSetupPanel enrollment={setup} />
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">6-digit code</label>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="px-3 py-2 border border-slate-300 rounded-lg font-mono w-36"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold"
            >
              Confirm
            </button>
            <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!codes && enrolled && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("regenerate")}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
          >
            Get new recovery codes
          </button>
          {!requiredForMe && (
            <button
              type="button"
              onClick={() => setMode("disable")}
              className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 font-semibold"
            >
              Turn off
            </button>
          )}
        </div>
      )}

      {!codes && enrolled && mode === "regenerate" && (
        <form onSubmit={regenerate} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current authenticator code</label>
            <input
              required
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="px-3 py-2 border border-slate-300 rounded-lg font-mono w-36"
            />
          </div>
          <button type="submit" disabled={busy} className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold">
            Issue new codes
          </button>
          <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold">
            Cancel
          </button>
        </form>
      )}

      {!codes && enrolled && mode === "disable" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-red-700">Turn off two-step login for your account?</span>
          <button type="button" disabled={busy} onClick={disable} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold">
            Turn off
          </button>
          <button type="button" onClick={reset} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
