"use client";

import React from "react";
import Link from "next/link";
import { X, Mail, Sparkles, ExternalLink } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export function AppShellDrawersAndModals({
  openMenu,
  closeMenus,
  sentEmails,
  globalModal,
  setGlobalModal,
  programs,
  partners,
  baseCurrency,
  partnerForm,
  setPartnerForm,
  handleCreatePartner,
  leadForm,
  setLeadForm,
  handleCreateLead,
  dealStep,
  setDealStep,
  dealForm,
  setDealForm,
  handleCreateDeal,
}: {
  openMenu: string | null;
  closeMenus: () => void;
  showToast?: (msg: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sentEmails: any[];
  globalModal: string | null;
  setGlobalModal: (m: "add_partner" | "submit_lead" | "register_deal" | "share_lead" | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[];
  baseCurrency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partnerForm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPartnerForm: (f: any) => void;
  handleCreatePartner: (e: React.FormEvent) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leadForm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setLeadForm: (f: any) => void;
  handleCreateLead: (e: React.FormEvent) => void;
  dealStep: 1 | 2 | 3;
  setDealStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dealForm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDealForm: (f: any) => void;
  handleCreateDeal: (e: React.FormEvent) => void;
}) {
  return (
    <>
      {/* Sent Emails / Outbox Slide-Over Drawer */}
      {openMenu === "outbox" && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">
                    Sent Emails Outbox ({sentEmails.length})
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Every Partner Invite, Notification &amp; SMTP delivery
                  </p>
                </div>
              </div>
              <button onClick={closeMenus}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <span className="text-blue-900 font-medium">
                  Check email connector status in{" "}
                  <strong>Manage &gt; Email setup</strong>.
                </span>
                <Link
                  href="/portal"
                  onClick={closeMenus}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold shrink-0"
                >
                  Open Partner Portal
                </Link>
              </div>

              {sentEmails.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No emails sent yet. Register a new partner or test an email
                  template in Manage &gt; Email templates!
                </p>
              ) : (
                sentEmails.map((em) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  let meta: any = {};
                  try {
                    meta = JSON.parse(em.metadataJson || "{}");
                  } catch {
                    meta = {};
                  }
                  const linkTarget = meta.activationUrl || meta.portalLink;
                  return (
                    <div
                      key={em.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {meta.templateName || "System Email"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {meta.deliveryMode || em.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {em.name}
                      </h4>
                      <p className="text-slate-600 font-medium">
                        To: <span className="text-blue-700">{meta.to}</span>
                      </p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 whitespace-pre-line">
                        {meta.body || em.subtitle}
                      </div>
                      {linkTarget && (
                        <div className="pt-1">
                          <a
                            href={linkTarget}
                            onClick={closeMenus}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                          >
                            <span>Activate Account &amp; Set Password</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* What's New Slide-Over Drawer */}
      {openMenu === "whatsnew" && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-base">What&apos;s New in R-PRM</h3>
              </div>
              <button onClick={closeMenus}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-sm">
              {[
                {
                  date: "Nov 2026",
                  tag: "AI & MCP",
                  title: "ChatGPT & Claude Partner Portal Assistants",
                  desc: "Partners can now draft joint business plans and summarize deal histories directly inside the portal.",
                },
                {
                  date: "Nov 2026",
                  tag: "Account Mapping",
                  title: "3×3 Real-Time Overlap Matrix & Co-Selling Collaborations",
                  desc: "Cross-reference your CRM Customers, Opportunities, and Prospects against partner rosters in one click.",
                },
                {
                  date: "Oct 2026",
                  tag: "Payouts",
                  title: "Automated Multi-Currency Threshold Payouts & Self-Invoicing",
                  desc: "Batch validated rewards into multi-currency settlement runs automatically.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                      {item.tag}
                    </span>
                    <span className="text-slate-500">{item.date}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mt-1">{item.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL MODAL 1: Add a New Partner */}
      {globalModal === "add_partner" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePartner}
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Add a new partner</h3>
              <button type="button" onClick={() => setGlobalModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-sm">
              <div className="font-semibold text-xs uppercase tracking-wider text-blue-700">
                Partner details
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Partner name *
                </label>
                <input
                  required
                  value={partnerForm.name}
                  onChange={(e) =>
                    setPartnerForm({ ...partnerForm, name: e.target.value })
                  }
                  placeholder="Acme Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Partner program
                  </label>
                  <select
                    value={partnerForm.programId || programs[0]?.id || ""}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        programId: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    {programs.length === 0 ? (
                      <option value="">No programs yet</option>
                    ) : (
                      programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    value={partnerForm.country}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        country: e.target.value,
                      })
                    }
                    placeholder="Country"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Language
                  </label>
                  <select
                    value={partnerForm.language}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        language: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option>English</option>
                    <option>French</option>
                    <option>Japanese</option>
                    <option>Spanish</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 font-semibold text-xs uppercase tracking-wider text-blue-700">
                Main contact
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First name *
                  </label>
                  <input
                    required
                    value={partnerForm.contactFirstName}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactFirstName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last name *
                  </label>
                  <input
                    required
                    value={partnerForm.contactLastName}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactLastName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={partnerForm.contactEmail}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactEmail: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={partnerForm.contactJobTitle}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactJobTitle: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone number
                  </label>
                  <input
                    value={partnerForm.contactPhone}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center space-x-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={partnerForm.portalAccess}
                  onChange={(e) =>
                    setPartnerForm({
                      ...partnerForm,
                      portalAccess: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>
                  <strong>Access to R-PRM:</strong> This contact has access to
                  the partner portal
                </span>
              </label>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setGlobalModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Create Partner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL MODAL 2: Submit Lead / Share Lead */}
      {(globalModal === "submit_lead" || globalModal === "share_lead") && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateLead}
            className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {globalModal === "share_lead"
                  ? "Share lead with partner"
                  : "Submit lead"}
              </h3>
              <button type="button" onClick={() => setGlobalModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {globalModal === "share_lead"
                    ? "Assign to partner *"
                    : "Source partner *"}
                </label>
                <select
                  value={leadForm.sourcePartnerName || partners[0]?.name || ""}
                  onChange={(e) =>
                    setLeadForm({
                      ...leadForm,
                      sourcePartnerName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {partners.length === 0 ? (
                    <option value="">No partners yet</option>
                  ) : (
                    partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    First name *
                  </label>
                  <input
                    required
                    value={leadForm.firstName}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Last name *
                  </label>
                  <input
                    required
                    value={leadForm.lastName}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    required
                    value={leadForm.company}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, company: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={leadForm.jobTitle}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, jobTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={leadForm.email}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Mobile number
                  </label>
                  <input
                    value={leadForm.phone}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={leadForm.country}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, country: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Singapore</option>
                    <option>Malaysia</option>
                    <option>Australia</option>
                    <option>United Kingdom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Retail brand name
                  </label>
                  <input
                    value={leadForm.retailBrand}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, retailBrand: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Number of outlets
                  </label>
                  <input
                    type="number"
                    value={leadForm.outletsCount}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, outletsCount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    POS Solution (If Any)
                  </label>
                  <input
                    value={leadForm.posSolution}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, posSolution: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Website / Social URL
                  </label>
                  <input
                    value={leadForm.website}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, website: e.target.value })
                    }
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={leadForm.deadline}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Feature Requirements / Remark:
                </label>
                <textarea
                  rows={2}
                  value={leadForm.remarks}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setGlobalModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {globalModal === "share_lead" ? "Share Lead" : "Submit Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL MODAL 3: 3-Step Register Deal Wizard */}
      {globalModal === "register_deal" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDeal}
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Register deal</h3>
                <p className="text-[11px] text-blue-100">
                  Step {dealStep} of 3:{" "}
                  {dealStep === 1
                    ? "Associated partner"
                    : dealStep === 2
                    ? "New deal"
                    : "Client information"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDealStep(1);
                  setGlobalModal(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-4 flex items-center space-x-2 text-xs">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-1.5 rounded-full ${
                    s <= dealStep ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="p-6 space-y-4 text-xs">
              {dealStep === 1 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Associated Partner *
                  </label>
                  <select
                    value={dealForm.partnerName || partners[0]?.name || ""}
                    onChange={(e) =>
                      setDealForm({ ...dealForm, partnerName: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                  >
                    {partners.length === 0 ? (
                      <option value="">No partners yet</option>
                    ) : (
                      partners.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                          {p.qualifyingLevel ? ` (${p.qualifyingLevel})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {dealStep === 2 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Deal Name *
                    </label>
                    <input
                      required
                      value={dealForm.name}
                      onChange={(e) =>
                        setDealForm({ ...dealForm, name: e.target.value })
                      }
                      placeholder="Acme Enterprise Rollout"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Total Amount *
                      </label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={dealForm.amount}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, amount: e.target.value })
                        }
                        placeholder="Enter amount"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={dealForm.currency || baseCurrency}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, currency: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Pipeline Stage
                      </label>
                      <select
                        value={dealForm.stage}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, stage: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option>To Work On</option>
                        <option>Appointment Scheduled</option>
                        <option>Holding</option>
                        <option>Discovery Stage</option>
                        <option>Presentation Stage</option>
                        <option>Quotation Stage</option>
                        <option>Negotiation Stage</option>
                        <option>Closing Stage</option>
                        <option>Closed Won</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Subscription Plan
                      </label>
                      <select
                        value={dealForm.subscriptionPlan}
                        onChange={(e) =>
                          setDealForm({
                            ...dealForm,
                            subscriptionPlan: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option>Enterprise Multi-Region</option>
                        <option>Enterprise Annual</option>
                        <option>Growth Pro Annual</option>
                        <option>Starter Annual</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {dealStep === 3 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Client Company Name *
                    </label>
                    <input
                      required
                      value={dealForm.company}
                      onChange={(e) =>
                        setDealForm({ ...dealForm, company: e.target.value })
                      }
                      placeholder="Acme Ltd"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Primary Client Contact *
                      </label>
                      <input
                        required
                        value={dealForm.clientName}
                        onChange={(e) =>
                          setDealForm({
                            ...dealForm,
                            clientName: e.target.value,
                          })
                        }
                        placeholder="Jane Doe"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        type="date"
                        value={dealForm.closeDate}
                        onChange={(e) =>
                          setDealForm({
                            ...dealForm,
                            closeDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between">
              {dealStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setDealStep((s) => (s === 3 ? 2 : 1))}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setDealStep(1);
                    setGlobalModal(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {dealStep < 3 ? "Next Step →" : "Register Deal"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
