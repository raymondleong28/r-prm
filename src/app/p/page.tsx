"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";
import {
  canPartnerAccessAsset,
  getPartnerLevelRules,
  SUPPORTED_CURRENCIES,
} from "@/lib/prmEngine";
import {
  Award,
  Download,
  Paperclip,
  Briefcase,
  Users,
  Gift,
  ExternalLink,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const PORTAL_NAV = [
  "Home",
  "Leads",
  "Deals",
  "Rewards",
  "Payouts",
  "Onboarding",
  "Assets",
  "Help Center",
  "News",
  "Team",
  "Profile & Bank",
] as const;

function StandalonePartnerPortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    partners,
    programs,
    deals,
    leads,
    rewards,
    payouts,
    manageItems,
    teamMembers,
    settings,
    session,
    loading,
    mutate,
    showToast,
  } = usePrm();

  const [activeNav, setActiveNav] =
    useState<(typeof PORTAL_NAV)[number]>("Home");

  // Determine partner strictly from server session or explicit coworker query param — never fall back to a default ID or partners[0]
  const targetPartnerId =
    session?.identityType === "partner"
      ? session.partnerId || ""
      : session?.impersonatingPartnerId ||
        searchParams.get("partnerId") ||
        "";

  const partner = partners.find((p) => p.id === targetPartnerId);
  const program = programs.find(
    (pr) => pr.id === partner?.programId || pr.name === partner?.programName
  );

  const acct = settings?.account_settings || {};
  const baseCurrency =
    acct.mainCurrency || partner?.currency || SUPPORTED_CURRENCIES[0];

  const role: "Manager" | "SalesRep" | "Stakeholder" =
    session?.identityType === "partner"
      ? session.role === "Sales Rep"
        ? "SalesRep"
        : (session.role as "Manager" | "SalesRep" | "Stakeholder") || "Manager"
      : "Manager";

  const isImpersonating =
    session?.identityType === "coworker" ||
    searchParams.get("impersonate") === "true";

  // Form states (empty initial values, no prefilled demo data)
  const [dealName, setDealName] = useState("");
  const [dealCompany, setDealCompany] = useState("");
  const [dealAmount, setDealAmount] = useState("");

  const [leadFirst, setLeadFirst] = useState("");
  const [leadLast, setLeadLast] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  const [selfInvoicingOptIn, setSelfInvoicingOptIn] = useState(false);
  const [bankName, setBankName] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  useEffect(() => {
    if (!partner?.id) return;
    fetch(`/api/partners?id=${encodeURIComponent(partner.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p?.bankDetailsJson) return;
        try {
          const parsed = JSON.parse(p.bankDetailsJson);
          if (typeof parsed.selfInvoicingOptIn === "boolean") {
            setSelfInvoicingOptIn(parsed.selfInvoicingOptIn);
          }
          if (parsed.bankName) setBankName(String(parsed.bankName));
          if (parsed.swiftCode) setSwiftCode(String(parsed.swiftCode));
          if (parsed.accountNumber)
            setAccountNumber(String(parsed.accountNumber));
        } catch {
          // ignore invalid or encrypted blob
        }
      })
      .catch(() => {});
  }, [partner?.id]);

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.href = "/p/login";
  };

  if (loading) {
    return (
      <div className="p-8 text-xs text-slate-500">Loading Partner Portal...</div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 shadow-sm text-center space-y-3 text-xs">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-base font-bold text-slate-900">
            Partner Record Not Found
          </h1>
          <p className="text-slate-600">
            {session?.identityType === "coworker"
              ? "Select a partner from the Partner Directory to preview or impersonate their portal."
              : "No active partner profile is linked to this session."}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {session?.identityType === "coworker" ? (
              <Link
                href="/partners/views/all"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Open Partner Directory →
              </Link>
            ) : (
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Return to Partner Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const levelRules = getPartnerLevelRules(partner, programs);
  const levelRulesSummary =
    levelRules.length > 0
      ? levelRules.map((r) => r.title).join(" + ")
      : "No commission rules configured";

  const personalLeadFormUrl = partner.leadFormToken
    ? `/forms/lead/${partner.leadFormToken}`
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let perms: Record<string, Record<string, any>> = {};
  try {
    perms = JSON.parse(program?.permissionsJson || "{}");
  } catch {
    perms = {};
  }

  const canViewLeads = perms?.Leads?.["Can view leads"]?.[role] ?? true;
  const canSubmitLeads = perms?.Leads?.["Can submit leads"]?.[role] ?? true;
  const canViewDeals = perms?.Deals?.["Can view deals"]?.[role] ?? true;
  const canRegisterDeals = perms?.Deals?.["Can register deals"]?.[role] ?? true;

  const myDeals = deals.filter((d) => d.partnerName === partner.name);
  const myLeads = leads.filter((l) => l.sourcePartnerName === partner.name);
  const myRewards = rewards.filter((r) => r.partnerName === partner.name);
  const myPayouts = payouts.filter((p) => p.partnerName === partner.name);
  const myTeam = teamMembers.filter((m) => m.partnerName === partner.name);

  const scopedAssets = manageItems.filter(
    (m) => m.category === "assets" && canPartnerAccessAsset(m, partner)
  );
  const helpArticles = manageItems.filter(
    (m) => m.category === "help_articles"
  );
  const newsItems = manageItems.filter((m) => m.category === "news");

  const handlePortalRegisterDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegisterDeals) return;
    const numericAmount = Number(dealAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast("Please enter a positive deal amount.");
      return;
    }
    await mutate(
      "CREATE_DEAL",
      {
        name: dealName,
        company: dealCompany,
        clientName: dealCompany,
        amount: numericAmount,
        currency: partner.currency || baseCurrency,
        partnerName: partner.name,
        assignedContact: `${partner.contactFirstName} ${partner.contactLastName}`.trim(),
        stage: "Discovery Stage",
      },
      `Deal "${dealName}" registered from ${partner.name} Partner Portal!`
    );
    setDealName("");
    setDealCompany("");
    setDealAmount("");
  };

  const handlePortalSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitLeads) return;
    await mutate(
      "CREATE_LEAD",
      {
        firstName: leadFirst,
        lastName: leadLast,
        company: leadCompany,
        email: leadEmail,
        sourcePartnerName: partner.name,
        assignedPartner: partner.name,
        assignedContact: `${partner.contactFirstName} ${partner.contactLastName}`.trim(),
        source: "Partner Portal",
      },
      `Lead "${leadFirst} ${leadLast}" submitted from Partner Portal!`
    );
    setLeadFirst("");
    setLeadLast("");
    setLeadCompany("");
    setLeadEmail("");
  };

  const handleExitImpersonation = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exit_impersonate" }),
    });
    router.push(`/partners/${partner.id}`);
  };

  // Parse onboarding stages from the partner's assigned pipeline if available
  const assignedPipelineItem = manageItems.find(
    (m) =>
      m.category === "onboarding_pipelines" &&
      m.name === partner.onboardingPipeline
  );
  let pipelineStages: Array<{ title: string; actionType?: string }> = [];
  if (assignedPipelineItem?.metadataJson) {
    try {
      const meta = JSON.parse(assignedPipelineItem.metadataJson);
      if (Array.isArray(meta.stages)) {
        pipelineStages = meta.stages;
      }
    } catch {
      pipelineStages = [];
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {isImpersonating && (
        <div className="bg-amber-500 text-slate-950 px-6 py-2 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4" />
            <span>
              Viewing as <strong>{partner.name}</strong> ({partner.contactEmail}
              ) — Impersonation session recorded in Audit Log
            </span>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="px-3 py-1 rounded bg-slate-900 text-white font-semibold"
          >
            Exit Impersonation →
          </button>
        </div>
      )}

      {/* Standalone Partner Portal Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <div
            style={{ backgroundColor: acct.primaryColor || "#2563EB" }}
            className="w-8 h-8 rounded-lg text-white font-extrabold text-lg flex items-center justify-center"
          >
            {acct.logoText || "R"}
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900">
              {partner.name}
            </span>
            {partner.qualifyingLevel && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {partner.qualifyingLevel}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto">
          {PORTAL_NAV.filter((nav) => {
            if (nav === "Leads" && !canViewLeads) return false;
            if (nav === "Deals" && !canViewDeals) return false;
            return true;
          }).map((nav) => (
            <button
              key={nav}
              onClick={() => setActiveNav(nav)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeNav === nav
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {nav}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            Role: {role}
          </span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
            title="Sign out of Partner Portal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-[1380px] w-full mx-auto px-6 py-6 space-y-6 text-xs">
        {activeNav === "Home" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-blue-700 font-bold">
                  <span>Qualifying Tier</span>
                  <Award className="w-4 h-4" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {partner.qualifyingLevel || "Unassigned"}
                </p>
                <p className="text-blue-700 font-semibold mt-0.5">
                  {levelRulesSummary}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-600 font-bold">
                  <span>My Registered Deals</span>
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {myDeals.length} Deals
                </p>
                <p className="text-slate-500 mt-0.5">
                  Won Sourced: {baseCurrency}{" "}
                  {(partner.sourcedRevenue365d || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-600 font-bold">
                  <span>My Submitted Leads</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {myLeads.length} Leads
                </p>
                {personalLeadFormUrl && (
                  <Link
                    href={personalLeadFormUrl}
                    className="text-blue-600 hover:underline font-semibold inline-flex items-center space-x-1 mt-0.5"
                  >
                    <span>Use your personal lead form</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>My Commissions</span>
                  <Gift className="w-4 h-4" />
                </div>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">
                  {baseCurrency}{" "}
                  {(partner.pendingRewardsAll || 0).toLocaleString()}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {myRewards.length} total reward records
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {canViewDeals && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-slate-900">
                      Quick Deal Registration
                    </h2>
                    {!canRegisterDeals && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                        View-only for {role} role
                      </span>
                    )}
                  </div>
                  {canRegisterDeals && (
                    <form
                      onSubmit={handlePortalRegisterDeal}
                      className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100"
                    >
                      <input
                        required
                        value={dealName}
                        onChange={(e) => setDealName(e.target.value)}
                        placeholder="Deal title *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        value={dealCompany}
                        onChange={(e) => setDealCompany(e.target.value)}
                        placeholder="Client company *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex space-x-1.5">
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="any"
                          value={dealAmount}
                          onChange={(e) => setDealAmount(e.target.value)}
                          placeholder={`Amount (${partner.currency || baseCurrency}) *`}
                          className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="submit"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                        >
                          Register
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="divide-y divide-slate-100">
                    {myDeals.length === 0 ? (
                      <p className="py-4 text-slate-400 text-center">
                        No registered deals yet.
                      </p>
                    ) : (
                      myDeals.map((d) => (
                        <div
                          key={d.id}
                          className="py-2.5 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{d.name}</p>
                            <p className="text-slate-500">
                              {d.company} · Stage: {d.stage}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-blue-700">
                              {d.currency} {d.amount.toLocaleString()}
                            </span>
                            <StatusBadge status={d.status} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {canViewLeads && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-slate-900">
                      Submit a Referral Lead
                    </h2>
                    {personalLeadFormUrl && (
                      <Link
                        href={personalLeadFormUrl}
                        className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
                      >
                        <span>Use your personal lead form</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  {canSubmitLeads ? (
                    <form
                      onSubmit={handlePortalSubmitLead}
                      className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100"
                    >
                      <input
                        required
                        value={leadFirst}
                        onChange={(e) => setLeadFirst(e.target.value)}
                        placeholder="First name *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        value={leadLast}
                        onChange={(e) => setLeadLast(e.target.value)}
                        placeholder="Last name *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        value={leadCompany}
                        onChange={(e) => setLeadCompany(e.target.value)}
                        placeholder="Company *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="Work email *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                      >
                        + Submit
                      </button>
                    </form>
                  ) : (
                    <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg">
                      Lead submission is disabled for the {role} role.
                    </p>
                  )}
                  <div className="divide-y divide-slate-100">
                    {myLeads.length === 0 ? (
                      <p className="py-4 text-slate-400 text-center">
                        No submitted leads yet.
                      </p>
                    ) : (
                      myLeads.map((l) => (
                        <div
                          key={l.id}
                          className="py-2.5 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {l.firstName} {l.lastName} · {l.company}
                            </p>
                            <p className="text-slate-500">
                              Submitted {l.assignedDate || "—"}
                              {l.deadline ? ` · Deadline ${l.deadline}` : ""}
                            </p>
                          </div>
                          <StatusBadge status={l.status} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeNav === "Leads" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900">
                My Leads ({myLeads.length})
              </h2>
              {personalLeadFormUrl && (
                <Link
                  href={personalLeadFormUrl}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                >
                  Use your personal lead form ↗
                </Link>
              )}
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Contact Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned Contact</th>
                  <th className="py-2.5 px-3">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {l.firstName} {l.lastName}
                    </td>
                    <td className="py-2.5 px-3">{l.company}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="py-2.5 px-3">{l.assignedContact}</td>
                    <td className="py-2.5 px-3">{l.deadline || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Deals" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Registered Deals ({myDeals.length})
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Deal Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Protection Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myDeals.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-2.5 px-3">{d.company}</td>
                    <td className="py-2.5 px-3 font-semibold text-blue-700">
                      {d.stage}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {d.currency} {d.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">{d.expirationDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Rewards" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Commission Rewards ({myRewards.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {myRewards.length === 0 ? (
                <p className="py-4 text-slate-400">No rewards recorded yet.</p>
              ) : (
                myRewards.map((r) => (
                  <div
                    key={r.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {r.rewardNumber} · {r.fromActivity}
                      </p>
                      <p className="text-slate-500">{r.fromRewardRule}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-700">
                        {r.currency} {r.amount.toLocaleString()} ({baseCurrency}{" "}
                        {(r.amountBase ?? r.amount ?? 0).toLocaleString()})
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeNav === "Payouts" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Payout Settlements ({myPayouts.length})
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Payout #</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3 text-right">Rewards</th>
                  <th className="py-2.5 px-3 text-right">
                    Amount ({baseCurrency})
                  </th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPayouts.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2.5 px-3 font-bold text-blue-700">
                      {po.payoutNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{po.name}</td>
                    <td className="py-2.5 px-3">
                      {po.periodFrom} → {po.periodTo}
                    </td>
                    <td className="py-2.5 px-3 text-right">{po.rewardsCount}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {baseCurrency}{" "}
                      {(po.amountBase ?? po.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="py-2.5 px-3">{po.paidDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Onboarding" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  My Onboarding Checklist — {partner.onboardingPipeline || "Unassigned"}
                </h2>
                <p className="text-slate-500">
                  Current Stage: <strong>{partner.onboardingStage || "—"}</strong>{" "}
                  ({partner.onboardingStatus})
                </p>
              </div>
              <StatusBadge status={partner.onboardingStatus} />
            </div>

            {pipelineStages.length === 0 ? (
              <p className="text-slate-500 py-4">
                No onboarding checklist stages configured for this pipeline yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pipelineStages.map((act, idx) => (
                  <div
                    key={`${act.title}-${idx}`}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-blue-700">
                        {act.actionType || "Stage"}
                      </span>
                      <p className="font-bold text-slate-900">{act.title}</p>
                    </div>
                    <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {partner.onboardingStage === act.title
                          ? "Current"
                          : partner.onboardingStatus}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "Assets" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-base text-slate-900">
                Scoped Enablement Assets ({scopedAssets.length})
              </h2>
              <p className="text-slate-500">
                Showing only assets authorized for{" "}
                <strong>{partner.programName}</strong>
                {partner.qualifyingLevel
                  ? ` (${partner.qualifyingLevel})`
                  : ""}
                {partner.groupName ? ` and group ${partner.groupName}` : ""}.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {scopedAssets.length === 0 ? (
                <p className="py-4 text-slate-400">
                  No enablement assets shared yet.
                </p>
              ) : (
                scopedAssets.map((a) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const assetAny = a as any;
                  let fileUrl = assetAny.fileUrl || "";
                  let fileName = assetAny.fileName || a.name;
                  if (a.metadataJson) {
                    try {
                      const meta = JSON.parse(a.metadataJson);
                      if (meta.fileUrl) fileUrl = meta.fileUrl;
                      if (meta.fileName) fileName = meta.fileName;
                    } catch {
                      // ignore
                    }
                  }
                  return (
                    <div
                      key={a.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{a.name}</p>
                        <p className="text-slate-500">{a.subtitle}</p>
                      </div>
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={fileName}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 flex items-center space-x-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Download</span>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400">No file attached</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeNav === "Help Center" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              Partner Help Center Articles ({helpArticles.length})
            </h2>
            {helpArticles.length === 0 ? (
              <p className="text-slate-400 py-2">No articles published yet.</p>
            ) : (
              helpArticles.map((art) => (
                <div
                  key={art.id}
                  className="p-3.5 rounded-xl border border-slate-200 space-y-1"
                >
                  <p className="font-bold text-slate-900">{art.name}</p>
                  <p className="text-slate-500">{art.subtitle}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeNav === "News" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              Partner Announcements &amp; News ({newsItems.length})
            </h2>
            {newsItems.length === 0 ? (
              <p className="text-slate-400 py-2">
                No announcements published yet.
              </p>
            ) : (
              newsItems.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-xl border border-slate-200 space-y-1"
                >
                  <p className="font-bold text-slate-900">{n.name}</p>
                  <p className="text-slate-500">{n.subtitle}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeNav === "Team" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              My Organization Team Members ({myTeam.length})
            </h2>
            {myTeam.length === 0 ? (
              <p className="text-slate-400 py-2">No team members listed yet.</p>
            ) : (
              myTeam.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">{m.name}</p>
                    <p className="text-slate-500">
                      {m.email} · {m.jobTitle} ({m.role})
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))
            )}
          </div>
        )}

        {activeNav === "Profile & Bank" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              Banking &amp; Self-Invoicing Setup
            </h2>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selfInvoicingOptIn}
                onChange={(e) => setSelfInvoicingOptIn(e.target.checked)}
              />
              <span className="font-semibold text-slate-800">
                Opt-in to Automated Self-Invoicing for Commission Payouts
              </span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Name
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Commercial Bank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  SWIFT / BIC Code
                </label>
                <input
                  value={swiftCode}
                  onChange={(e) => setSwiftCode(e.target.value)}
                  placeholder="BANKXX22"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Account Number
                </label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="000-000000-0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={() =>
                mutate(
                  "UPDATE_PARTNER",
                  {
                    id: partner.id,
                    data: {
                      bankDetailsJson: JSON.stringify({
                        bankName,
                        swiftCode,
                        accountNumber,
                        selfInvoicingOptIn,
                      }),
                    },
                  },
                  "Partner banking & self-invoicing details saved!"
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Save Banking &amp; Self-Invoicing Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StandalonePartnerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-xs text-slate-500">
          Loading Partner Portal...
        </div>
      }
    >
      <StandalonePartnerPortalContent />
    </Suspense>
  );
}
