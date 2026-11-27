"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface PublicWorkspaceMeta {
  accountName: string;
  logoText: string;
  primaryColor: string;
  leadConsentText: string;
  leadConsentTermsLabel: string;
  leadConsentTermsUrl: string;
}

export default function PublicPartnerLeadFormPage() {
  const params = useParams();
  const token = String(params?.uuid || "");

  const [checking, setChecking] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [partner, setPartner] = useState<any | null>(null);
  const [workspace, setWorkspace] = useState<PublicWorkspaceMeta>({
    accountName: "Workspace",
    logoText: "R",
    primaryColor: "#2563EB",
    leadConsentText:
      "I confirm that I have obtained permission from this prospect to share their business contact details.",
    leadConsentTermsLabel: "Terms & Privacy Policy",
    leadConsentTermsUrl: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    jobTitle: "",
    email: "",
    phone: "",
    country: "",
    retailBrand: "",
    outletsCount: "",
    posSolution: "",
    remarks: "",
    consentConfirmed: false,
  });

  useEffect(() => {
    async function verifyToken() {
      try {
        const res = await fetch(
          `/api/public-forms?leadToken=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (json?.workspace) {
          setWorkspace(json.workspace);
        }
        if (!res.ok || !json?.valid) {
          setPartner(null);
        } else {
          setPartner(json.partner);
        }
      } catch {
        setPartner(null);
      } finally {
        setChecking(false);
      }
    }
    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.consentConfirmed) {
      setError("Please confirm prospect data consent before submitting.");
      return;
    }

    const res = await fetch("/api/public-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: "public_lead",
        payload: {
          ...form,
          token,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to submit referral lead");
      return;
    }
    setSubmitted(true);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-xs text-slate-500">
        Verifying referral link...
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center space-y-3 text-xs">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-slate-900">
            This link isn&apos;t valid
          </h1>
          <p className="text-slate-600">
            This referral lead form URL is invalid or has been rotated. Please
            request an updated personal referral link from your{" "}
            {workspace.accountName} partner representative.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl border border-slate-200 overflow-hidden text-xs">
        <div
          style={{ backgroundColor: workspace.primaryColor || "#2563EB" }}
          className="p-6 text-white flex items-center space-x-3"
        >
          <div className="w-10 h-10 rounded-xl bg-white text-slate-900 font-extrabold text-xl flex items-center justify-center">
            {workspace.logoText || "R"}
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded font-bold">
              {workspace.accountName} · Verified Partner Referral Form
            </span>
            <h1 className="text-lg font-extrabold mt-1">
              Referred by {partner.name}
            </h1>
          </div>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">
              Thank you! Your referral lead has been registered.
            </h2>
            <p className="text-slate-600">
              Attributed to <strong>{partner.name}</strong> ({partner.programName}
              ).
            </p>
            <button
              onClick={() => {
                setForm({
                  firstName: "",
                  lastName: "",
                  company: "",
                  jobTitle: "",
                  email: "",
                  phone: "",
                  country: "",
                  retailBrand: "",
                  outletsCount: "",
                  posSolution: "",
                  remarks: "",
                  consentConfirmed: false,
                });
                setSubmitted(false);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Submit Another Referral Lead
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  First Name *
                </label>
                <input
                  required
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  placeholder="Jane"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Last Name *
                </label>
                <input
                  required
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  placeholder="Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  required
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  placeholder="Acme Ltd"
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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@acme.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 555 0100"
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
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Locations / Seats
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.outletsCount}
                  onChange={(e) =>
                    setForm({ ...form, outletsCount: e.target.value })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Requirements / Notes
              </label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Project scope or context..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200 cursor-pointer">
              <input
                required
                type="checkbox"
                checked={form.consentConfirmed}
                onChange={(e) =>
                  setForm({ ...form, consentConfirmed: e.target.checked })
                }
                className="mt-0.5 rounded text-blue-600"
              />
              <span className="text-slate-700 leading-relaxed">
                {workspace.leadConsentText}{" "}
                {workspace.leadConsentTermsUrl ? (
                  <>
                    (
                    <a
                      href={workspace.leadConsentTermsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 font-semibold underline"
                    >
                      {workspace.leadConsentTermsLabel || "Terms & Privacy Policy"}
                    </a>
                    ){" "}
                  </>
                ) : null}
                *
              </span>
            </label>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow"
            >
              Submit Referral Inquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
