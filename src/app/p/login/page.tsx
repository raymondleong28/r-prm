"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MfaSetupPanel,
  RecoveryCodesPanel,
  type MfaEnrollmentView,
} from "@/components/MfaPanels";
import { AlertCircle } from "lucide-react";

export default function PartnerPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollmentView | null>(null);
  const [mfaAsked, setMfaAsked] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCodesLeft, setRecoveryCodesLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState({
    accountName: "R-PRM",
    logoText: "R",
    primaryColor: "#2563EB",
    portalDomain: "",
  });

  React.useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d?.needsSetup) {
          window.location.href = "/setup";
          return;
        }
        if (d?.branding) setBranding(d.branding);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityType: "partner",
          email,
          password,
          mfaCode: mfaCode || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.mfaEnrollmentRequired && json.enrollment) {
          setMfaEnrollment(json.enrollment);
          setMfaAsked(true);
        } else if (json.mfaRequired) {
          setMfaAsked(true);
        }
        setError(json.error || "Partner sign-in failed");
        setSubmitting(false);
        return;
      }
      if (Array.isArray(json.recoveryCodes) && json.recoveryCodes.length > 0) {
        setRecoveryCodes(json.recoveryCodes);
        setSubmitting(false);
        return;
      }
      if (typeof json.recoveryCodesLeft === "number") {
        setRecoveryCodesLeft(json.recoveryCodesLeft);
        setSubmitting(false);
        return;
      }
      window.location.href = "/p";
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center space-x-3">
          <div
            style={{ backgroundColor: branding.primaryColor || "#2563EB" }}
            className="w-10 h-10 rounded-xl text-white font-extrabold text-xl flex items-center justify-center"
          >
            {branding.logoText || "R"}
          </div>
          <div>
            {branding.portalDomain && (
              <span className="text-[10px] font-bold uppercase text-blue-600">
                {branding.portalDomain}
              </span>
            )}
            <h1 className="text-lg font-extrabold text-slate-900">
              {branding.accountName || "R-PRM"} Partner Portal
            </h1>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {recoveryCodes && (
          <RecoveryCodesPanel
            codes={recoveryCodes}
            onContinue={() => {
              window.location.href = "/p";
            }}
          />
        )}

        {recoveryCodesLeft !== null && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-[11px] text-slate-800">
            <p className="font-bold text-amber-900">You signed in with a recovery code</p>
            <p>
              You have {recoveryCodesLeft} recovery code{recoveryCodesLeft === 1 ? "" : "s"} left.
              {recoveryCodesLeft <= 3 &&
                " Get new ones from Account Settings → Security once you have your authenticator again."}
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/p";
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
            >
              Continue
            </button>
          </div>
        )}

        {!recoveryCodes && recoveryCodesLeft === null && mfaEnrollment && (
          <MfaSetupPanel enrollment={mfaEnrollment} />
        )}

        {!recoveryCodes && recoveryCodesLeft === null && (
        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Partner Work Email *
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@partner-company.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password *
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          {mfaAsked && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {mfaEnrollment
                  ? "6-digit code from your authenticator app *"
                  : "Authenticator code or recovery code *"}
              </label>
              <input
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={mfaEnrollment ? "numeric" : "text"}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={mfaEnrollment ? "123456" : "123456 or ABCDE-FGHIJ"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm"
          >
            {submitting ? "Signing in..." : "Sign in to Partner Portal"}
          </button>
        </form>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
          <span>Invited partners receive an activation link by email.</span>
          <Link href="/login" className="text-slate-400 hover:text-slate-600">
            Coworker Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
