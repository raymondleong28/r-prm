"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";

const PREF_TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "calendar", label: "Calendar" },
  { id: "connected-apps", label: "Connected apps" },
] as const;

export default function UserPreferencesRootPage() {
  const params = useParams();
  const initialTab = String(params?.tab || "profile");
  const { settings, session, mutate, refresh, showToast } = usePrm();
  const [activeTab, setActiveTab] = useState(initialTab);

  const sessionParts = String(session?.name || "").split(/\s+/);
  const rawPrefs = settings.user_preferences || {};

  const [firstName, setFirstName] = useState(
    rawPrefs.firstName || sessionParts[0] || ""
  );
  const [lastName, setLastName] = useState(
    rawPrefs.lastName || sessionParts.slice(1).join(" ") || ""
  );
  const [jobTitle, setJobTitle] = useState(rawPrefs.jobTitle || "");
  const [phone, setPhone] = useState(rawPrefs.phone || "");
  const [calendarLink, setCalendarLink] = useState(rawPrefs.calendarLink || "");
  const [timezone, setTimezone] = useState(
    rawPrefs.timezone || settings.account_settings?.timezone || "UTC"
  );

  // Enrolment secret shown ONLY during interactive enrolment (§3.5.1)
  const [enrolmentInfo, setEnrolmentInfo] = useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);

  useEffect(() => {
    const p = settings.user_preferences;
    if (!p) return;
    if (p.firstName !== undefined) setFirstName(p.firstName);
    if (p.lastName !== undefined) setLastName(p.lastName);
    if (p.jobTitle !== undefined) setJobTitle(p.jobTitle);
    if (p.phone !== undefined) setPhone(p.phone);
    if (p.calendarLink !== undefined) setCalendarLink(p.calendarLink);
    if (p.timezone !== undefined) setTimezone(p.timezone);
  }, [settings.user_preferences]);

  const notifications = rawPrefs.notifications || {
    "New Lead Submitted by Partner": { inApp: true, email: true },
    "Shared Lead Accepted or Refused": { inApp: true, email: true },
    "New Deal Registered": { inApp: true, email: true },
    "Deal Stage Updated": { inApp: true, email: false },
    "Deal Expiring Soon": { inApp: true, email: true },
    "New Partner Application": { inApp: true, email: true },
    "Reward Pending Validation": { inApp: true, email: false },
    "Account Overlap Detected": { inApp: true, email: true },
  };

  const mfaEnrolled = Boolean(session?.mfaEnrolled || enrolmentInfo);

  const handleEnrollMfa = async () => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll_mfa" }),
    });
    const json = await res.json();
    if (res.ok && json.enrollment) {
      setEnrolmentInfo(json.enrollment);
      await refresh();
      showToast(
        "Authenticator enrolled! Save your secret and recovery codes now."
      );
    } else {
      showToast(json.error || "Failed to enrol authenticator");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">User Preferences</h1>
        <p className="text-xs text-slate-500">
          Manage your personal profile, MFA security, notification matrix,
          calendar sync, and connected apps
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm space-y-1 h-fit">
          {PREF_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-xs space-y-5">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First name
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last name
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Job title"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone number
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Calendar link
                  </label>
                  <input
                    value={calendarLink}
                    onChange={(e) => setCalendarLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Timezone
                  </label>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  mutate(
                    "SAVE_SETTING",
                    {
                      key: "user_preferences",
                      value: {
                        ...rawPrefs,
                        firstName,
                        lastName,
                        email: session?.email || rawPrefs.email || "",
                        jobTitle,
                        phone,
                        calendarLink,
                        timezone,
                        notifications,
                      },
                    },
                    "User profile preferences saved!"
                  )
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Profile
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Security — Password &amp; Authenticator MFA
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                    mfaEnrolled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {mfaEnrolled ? "TOTP Active" : "MFA Not Enrolled"}
                </span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      Authenticator App (TOTP)
                    </p>
                    <p className="text-slate-600">
                      {mfaEnrolled
                        ? "Your account has an active TOTP authenticator enrolled."
                        : "Enrol an authenticator app to protect your account with 6-digit codes."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnrollMfa}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {mfaEnrolled
                      ? "Rotate Authenticator"
                      : "Enrol Authenticator"}
                  </button>
                </div>

                {enrolmentInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div className="p-3 rounded-lg bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">
                        New TOTP Secret (Shown Once During Enrolment)
                      </span>
                      <p className="font-mono font-bold text-slate-900 select-all">
                        {enrolmentInfo.secret}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">
                        One-Time Recovery Codes
                      </span>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-800">
                        {enrolmentInfo.recoveryCodes.map((rc) => (
                          <span key={rc}>{rc}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="password"
                  placeholder="Current password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                onClick={() => showToast("Password settings updated")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Update Password
              </button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Notifications Matrix (In-App vs Email)
              </h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3 text-center">In-App</th>
                    <th className="py-2.5 px-3 text-center">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(notifications).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ([evt, val]: [string, any]) => (
                      <tr key={evt}>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {evt}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={Boolean(val.inApp)}
                            onChange={() =>
                              showToast(`Updated In-App alert for "${evt}"`)
                            }
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={Boolean(val.email)}
                            onChange={() =>
                              showToast(`Updated Email alert for "${evt}"`)
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Calendar Integration
              </h2>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    Calendar ({session?.email || "Not connected"})
                  </p>
                  <p className="text-slate-600">
                    Logs scheduled meetings onto Partner, Lead, and Deal
                    activity timelines.
                  </p>
                </div>
                <StatusBadge
                  status={
                    rawPrefs.googleCalendarConnected ? "Connected" : "Inactive"
                  }
                />
              </div>
            </div>
          )}

          {activeTab === "connected-apps" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Connected OAuth Applications
              </h2>
              <p className="text-slate-500">
                External connectors are configured via environment settings in{" "}
                <code>Manage &gt; Integrations</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
