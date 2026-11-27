"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

function ActivatePartnerAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{
    valid: boolean;
    email?: string;
    name?: string;
    partnerName?: string;
    role?: string;
    error?: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenInfo({ valid: false, error: "Missing activation token in URL" });
      setLoading(false);
      return;
    }
    fetch(`/api/auth?activateToken=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setTokenInfo({
            valid: false,
            error: data.error || "This activation link is invalid or has expired",
          });
        } else {
          setTokenInfo(data);
        }
      })
      .catch((err) => {
        setTokenInfo({ valid: false, error: String(err) });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_account",
          token,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Activation failed");
        setSubmitting(false);
        return;
      }
      setActivated(true);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-xs text-slate-300">
        Verifying single-use partner activation token...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-xl flex items-center justify-center">
            R
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-600">
              Partner Portal Invitation
            </span>
            <h1 className="text-lg font-extrabold text-slate-900">
              Activate Your Partner Account
            </h1>
          </div>
        </div>

        {!tokenInfo?.valid ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-1">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Activation Link Not Valid</span>
              </div>
              <p>{tokenInfo?.error || "This activation link is invalid, expired, or has already been used."}</p>
            </div>
            <Link
              href="/p/login"
              className="block w-full text-center py-2.5 rounded-xl bg-blue-600 text-white font-bold"
            >
              Go to Partner Portal Sign In →
            </Link>
          </div>
        ) : activated ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">
              Password Set &amp; Account Activated!
            </h2>
            <p className="text-slate-600">
              Your account <strong>{tokenInfo.email}</strong> ({tokenInfo.partnerName}) is now active. You may now sign in with the password you chose.
            </p>
            <Link
              href="/p/login"
              className="block w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold"
            >
              Sign In to Partner Portal →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-3.5">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Verified Invitation</span>
              </div>
              <p>
                Partner: <strong>{tokenInfo.partnerName}</strong>
              </p>
              <p>
                Email: <strong>{tokenInfo.email}</strong> · Role:{" "}
                <strong>{tokenInfo.role}</strong>
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Create Password (min. 8 characters) *
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Confirm Password *
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
            >
              {submitting ? "Activating Account..." : "Set Password & Activate Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ActivatePartnerAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-xs text-white">
          Loading Activation...
        </div>
      }
    >
      <ActivatePartnerAccountContent />
    </Suspense>
  );
}
