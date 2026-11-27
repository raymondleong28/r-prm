"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export default function FirstRunSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [requireSetupToken, setRequireSetupToken] = useState(false);

  const [setupToken, setSetupToken] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("UTC (GMT+00:00)");
  const [mainCurrency, setMainCurrency] = useState("");
  const [logoText, setLogoText] = useState("R");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [portalDomain, setPortalDomain] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setNeedsSetup(Boolean(d.needsSetup));
        setRequireSetupToken(Boolean(d.requireSetupToken));
        setChecking(false);
        if (!d.needsSetup) {
          router.replace("/login");
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken: setupToken || undefined,
          workspaceName,
          timezone,
          mainCurrency,
          logoText,
          primaryColor,
          portalDomain:
            portalDomain ||
            `https://partners.${workspaceName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") || "workspace"}.local`,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to complete workspace setup");
        setSubmitting(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-xs text-slate-300">
        Checking workspace setup status...
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-4 text-xs">
          <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Workspace Already Configured</span>
          </div>
          <p className="text-slate-600">
            First-run setup is permanently disabled once an Administrator account
            exists.
          </p>
          <a
            href="/login"
            className="block text-center py-2.5 rounded-xl bg-blue-600 text-white font-bold"
          >
            Go to Coworker Sign In →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl space-y-6 text-xs">
        <div className="flex items-center space-x-3">
          <div
            style={{ backgroundColor: primaryColor || "#2563EB" }}
            className="w-11 h-11 rounded-xl text-white font-extrabold text-xl flex items-center justify-center shadow-sm"
          >
            {(logoText || workspaceName.charAt(0) || "R")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              First-Run Installation Setup
            </span>
            <h1 className="text-lg font-extrabold text-slate-900">
              Create Your R-PRM Workspace
            </h1>
            <p className="text-slate-500">
              Configure your organisation&apos;s defaults and create the first
              Administrator account.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {requireSetupToken && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
              <label className="block font-bold text-amber-900">
                Production Setup Token (SETUP_TOKEN) *
              </label>
              <input
                required
                type="password"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Enter one-time SETUP_TOKEN from server environment"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white font-mono"
              />
            </div>
          )}

          <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
            1. Workspace &amp; Branding Settings
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Workspace / Organisation Name *
              </label>
              <input
                required
                value={workspaceName}
                onChange={(e) => {
                  setWorkspaceName(e.target.value);
                  if (e.target.value && logoText === "R") {
                    setLogoText(e.target.value.charAt(0).toUpperCase());
                  }
                }}
                placeholder="e.g. Acme Partner Cloud"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Timezone *
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
                <option value="Asia/Kuala_Lumpur (GMT+08:00)">
                  Asia/Kuala_Lumpur (GMT+08:00)
                </option>
                <option value="Asia/Singapore (GMT+08:00)">
                  Asia/Singapore (GMT+08:00)
                </option>
                <option value="Europe/London (GMT+00:00)">
                  Europe/London (GMT+00:00)
                </option>
                <option value="America/New_York (GMT-05:00)">
                  America/New_York (GMT-05:00)
                </option>
                <option value="Australia/Sydney (GMT+10:00)">
                  Australia/Sydney (GMT+10:00)
                </option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Main Currency *
              </label>
              <select
                required
                value={mainCurrency}
                onChange={(e) => setMainCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Select currency...</option>
                <option value="MYR">Malaysian Ringgit (MYR)</option>
                <option value="SGD">Singapore Dollar (SGD)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="AUD">Australian Dollar (AUD)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Brand Emblem (1–2 letters)
              </label>
              <input
                maxLength={2}
                value={logoText}
                onChange={(e) => setLogoText(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Primary Colour
              </label>
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Partner Portal Domain
              </label>
              <input
                value={portalDomain}
                onChange={(e) => setPortalDomain(e.target.value)}
                placeholder="https://partners.yourdomain.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1 pt-2">
            2. First Administrator Account
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Work Email *
              </label>
              <input
                required
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Password (min. 8 characters) *
              </label>
              <input
                required
                minLength={8}
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Create a strong administrator password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {submitting
                ? "Creating workspace..."
                : "Create Workspace & Administrator Account"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
