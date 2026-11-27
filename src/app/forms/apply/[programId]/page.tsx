"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";

export default function PublicPartnerApplicationFormPage() {
  const params = useParams();
  const programId = String(params?.programId || "");

  const [checking, setChecking] = useState(true);
  const [program, setProgram] = useState<{
    id: string;
    name: string;
    termsRequired?: boolean;
    termsUrl?: string;
  } | null>(null);
  const [workspace, setWorkspace] = useState({
    accountName: "Workspace",
    logoText: "R",
    primaryColor: "#2563EB",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    companyWebsite: "",
    companyPhone: "",
    industry: "",
    country: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactJobTitle: "",
    linkedInUrl: "",
    reasonForInterest: "",
  });

  useEffect(() => {
    if (!programId) {
      setProgram(null);
      setChecking(false);
      return;
    }
    fetch(`/api/public-forms?programId=${encodeURIComponent(programId)}`, {
      cache: "no-store",
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (data?.workspace) {
          setWorkspace(data.workspace);
        }
        if (ok && data?.valid && data?.program) {
          setProgram(data.program);
        } else {
          setProgram(null);
        }
      })
      .catch(() => setProgram(null))
      .finally(() => setChecking(false));
  }, [programId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "public_application",
          data: {
            companyName: form.companyName,
            name: form.companyName,
            programId: program.id,
            programName: program.name,
            country: form.country,
            contactFirstName: form.contactFirstName,
            contactLastName: form.contactLastName,
            contactEmail: form.contactEmail,
            contactJobTitle: form.contactJobTitle,
            companyPhone: form.companyPhone,
            companyWebsite: form.companyWebsite,
            industry: form.industry,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to submit application");
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-xs text-slate-500">
        Loading partner program application...
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center space-y-3 text-xs">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-slate-900">
            Program Not Found
          </h1>
          <p className="text-slate-600">
            The partner program application link is invalid or the program is no
            longer accepting applications.
          </p>
          <Link
            href="/p/login"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
          >
            Partner Portal Sign In →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden text-xs">
        <div
          style={{ backgroundColor: workspace.primaryColor || "#2563EB" }}
          className="p-6 text-white flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white text-slate-900 font-extrabold text-xl flex items-center justify-center">
              {workspace.logoText || "R"}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded font-bold">
                {workspace.accountName} · Partner Program Application
              </span>
              <h1 className="text-lg font-extrabold mt-1">
                Apply to {program.name}
              </h1>
            </div>
          </div>
          <Link
            href="/p/login"
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold"
          >
            Existing Partner Sign In
          </Link>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">
              Application Received!
            </h2>
            <p className="text-slate-600 max-w-md mx-auto">
              Your application for <strong>{program.name}</strong> has been
              received for <strong>{form.contactEmail}</strong>. Once approved,
              you will receive a time-limited activation link to access your
              Partner Portal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                {error}
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center space-x-2 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Data Safety Policy:</strong> Bank payout details are
                never collected on the public application form; they are
                collected securely inside your Partner Portal after acceptance.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Company Name *
                </label>
                <input
                  required
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="Acme Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Website *
                </label>
                <input
                  required
                  value={form.companyWebsite}
                  onChange={(e) =>
                    setForm({ ...form, companyWebsite: e.target.value })
                  }
                  placeholder="https://acme.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business Industry
                </label>
                <input
                  value={form.industry}
                  onChange={(e) =>
                    setForm({ ...form, industry: e.target.value })
                  }
                  placeholder="IT & Consulting"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Country
                </label>
                <input
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                  placeholder="Malaysia"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Main Contact First Name *
                </label>
                <input
                  required
                  value={form.contactFirstName}
                  onChange={(e) =>
                    setForm({ ...form, contactFirstName: e.target.value })
                  }
                  placeholder="Jane"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Main Contact Last Name *
                </label>
                <input
                  required
                  value={form.contactLastName}
                  onChange={(e) =>
                    setForm({ ...form, contactLastName: e.target.value })
                  }
                  placeholder="Doe"
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
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  placeholder="jane@acme.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  value={form.companyPhone}
                  onChange={(e) =>
                    setForm({ ...form, companyPhone: e.target.value })
                  }
                  placeholder="+1 555 0100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role / Job Title
                </label>
                <input
                  value={form.contactJobTitle}
                  onChange={(e) =>
                    setForm({ ...form, contactJobTitle: e.target.value })
                  }
                  placeholder="Head of Partnerships"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Social Profile (LinkedIn)
                </label>
                <input
                  value={form.linkedInUrl}
                  onChange={(e) =>
                    setForm({ ...form, linkedInUrl: e.target.value })
                  }
                  placeholder="https://linkedin.com/company/acme"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for interest &amp; How you heard about us
              </label>
              <textarea
                rows={2}
                value={form.reasonForInterest}
                onChange={(e) =>
                  setForm({ ...form, reasonForInterest: e.target.value })
                }
                placeholder="Tell us briefly about your partnership goals..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow"
            >
              {submitting
                ? "Submitting Application..."
                : "Submit Partner Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
