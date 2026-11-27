"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import {
  BackBreadcrumb,
  StatusBadge,
  NotesAndActivitiesTab,
} from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { ExternalLink, Edit3, Check, Award, Plus } from "lucide-react";

const RIGHT_TABS = [
  "Onboarding",
  "Dashboard",
  "Account Mapping",
  "Activities",
  "Rewards",
  "Links",
  "Notes",
  "Meetings",
  "Tasks",
  "Attachments",
  "Certifications",
  "Team",
  "Customize",
] as const;

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const {
    partners,
    programs,
    deals,
    leads,
    rewards,
    accounts,
    trackingLinks,
    teamMembers,
    manageItems,
    settings,
    loading,
    mutate,
  } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  // §1.4 & §3.5.1: Never fall back to a hardcoded ID or partners[0]
  const partner = partners.find((p) => p.id === id);

  const [activeTab, setActiveTab] =
    useState<(typeof RIGHT_TABS)[number]>("Onboarding");
  const [editing, setEditing] = useState(false);
  const [levelSelect, setLevelSelect] = useState("");
  const [editFields, setEditFields] = useState<{
    owner?: string;
    partnerType?: string;
    country?: string;
    companyWebsite?: string;
    companyAddress?: string;
    industry?: string;
  }>({});

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("Sales Rep");

  const allCertifications = manageItems.filter(
    (m) => m.category === "certifications"
  );
  const [selectedCertId, setSelectedCertId] = useState("");

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading partner...</div>;
  }

  if (!partner) {
    return (
      <div className="max-w-xl mx-auto p-8 space-y-3">
        <BackBreadcrumb href="/partners/views/all" label="Partners" />
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Partner not found</p>
          <p className="text-xs text-slate-500 mt-1">
            No partner record exists with ID <code>{id || "(empty)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  let bankInfo: Record<string, string> = {};
  try {
    bankInfo = JSON.parse(partner.bankDetailsJson || "{}");
  } catch {
    bankInfo = {};
  }

  const matchedProgram = programs.find(
    (pr) => pr.id === partner.programId || pr.name === partner.programName
  );
  let programLevelNames: string[] = [];
  if (matchedProgram?.levelsJson) {
    try {
      const parsedLevels = JSON.parse(matchedProgram.levelsJson);
      if (Array.isArray(parsedLevels)) {
        programLevelNames = parsedLevels
          .map((l: { name?: string }) => String(l?.name || "").trim())
          .filter(Boolean);
      }
    } catch {
      programLevelNames = [];
    }
  }
  if (
    partner.qualifyingLevel &&
    !programLevelNames.includes(partner.qualifyingLevel)
  ) {
    programLevelNames = [partner.qualifyingLevel, ...programLevelNames];
  }

  const partnerDeals = deals.filter((d) => d.partnerName === partner.name);
  const partnerLeads = leads.filter(
    (l) => l.sourcePartnerName === partner.name
  );
  const partnerRewards = rewards.filter((r) => r.partnerName === partner.name);
  const partnerOverlaps = accounts.filter(
    (a) => a.partnerName === partner.name
  );
  const partnerLinks = trackingLinks.filter(
    (l) => l.partnerName === partner.name
  );
  const partnerTeam = teamMembers.filter((m) => m.partnerName === partner.name);

  const handleSaveLevel = async (newLevel: string) => {
    setLevelSelect(newLevel);
    await mutate(
      "UPDATE_PARTNER",
      { id: partner.id, data: { qualifyingLevel: newLevel } },
      `Partner level updated to ${newLevel}`
    );
  };

  const handleSaveProperties = async () => {
    await mutate(
      "UPDATE_PARTNER",
      { id: partner.id, data: editFields },
      "Partner properties saved!"
    );
    setEditing(false);
  };

  const handleAwardCert = async (e: React.FormEvent) => {
    e.preventDefault();
    const cert =
      allCertifications.find((c) => c.id === selectedCertId) ||
      allCertifications[0];
    if (!cert) return;
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(cert.metadataJson || "{}");
    } catch {
      meta = {};
    }
    const existingList = Array.isArray(meta.awardedPartners)
      ? (meta.awardedPartners as string[])
      : [];
    const updatedList = Array.from(new Set([...existingList, partner.name]));
    await mutate(
      "UPDATE_MANAGE_ITEM",
      {
        id: cert.id,
        metadata: { ...meta, awardedPartners: updatedList },
      },
      `Awarded "${cert.name}" to ${partner.name}!`
    );
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !memberEmail) return;
    await mutate(
      "CREATE_TEAM_MEMBER",
      {
        name: memberName,
        email: memberEmail,
        role: memberRole,
        partnerName: partner.name,
        jobTitle: "Partner Portal User",
      },
      `Invited ${memberName} (${memberEmail}) to ${partner.name} portal!`
    );
    setMemberName("");
    setMemberEmail("");
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/partners/views/all" label="Partners" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{partner.name}</h1>
            <StatusBadge status={partner.status} />
            {partner.qualifyingLevel && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {partner.qualifyingLevel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {partner.status === "Pending" && (
            <button
              onClick={() =>
                mutate(
                  "UPDATE_PARTNER",
                  { id: partner.id, data: { status: "Active" } },
                  `${partner.name} approved and activated!`
                )
              }
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              Approve Application
            </button>
          )}
          <button
            onClick={async () => {
              await mutate("LOG_IMPERSONATION", {
                partnerId: partner.id,
                partnerName: partner.name,
              });
              router.push(`/p?partnerId=${partner.id}&impersonate=true`);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open partner portal</span>
          </button>
        </div>
      </div>

      {/* Computed Partner KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <p className="text-slate-500">Submitted leads (Last 365 days)</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {partner.submittedLeads365d}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <p className="text-slate-500">Registered deals (Last 365 days)</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {partner.registeredDeals365d}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-sm">
          <p className="text-blue-800 font-medium">
            Partner-sourced revenue (365d)
          </p>
          <p className="text-xl font-extrabold text-blue-700 mt-1">
            {baseCurrency}{" "}
            {Number(partner.sourcedRevenue365d || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <p className="text-slate-500">Partner-influenced revenue (365d)</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {baseCurrency}{" "}
            {Number(partner.influencedRev365d || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-sm">
          <p className="text-emerald-800 font-medium">
            Pending rewards (All time)
          </p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">
            {baseCurrency}{" "}
            {Number(partner.pendingRewardsAll || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-blue-700 font-bold">
                <Award className="w-4 h-4" />
                <span>{partner.programName || "Unassigned Program"}</span>
              </div>
              {programLevelNames.length > 0 && (
                <select
                  value={levelSelect || partner.qualifyingLevel}
                  onChange={(e) => handleSaveLevel(e.target.value)}
                  className="px-2 py-1 border border-blue-300 rounded text-xs font-semibold text-blue-700 bg-blue-50"
                >
                  {programLevelNames.map((lvlName) => (
                    <option key={lvlName} value={lvlName}>
                      {lvlName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-slate-500">
              Qualifying level determines commission rewards &amp; portal
              permissions.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">
                About this partner
              </h3>
              {editing ? (
                <button
                  onClick={handleSaveProperties}
                  className="text-emerald-700 hover:underline font-bold flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditFields({
                      owner: partner.owner,
                      partnerType: partner.partnerType,
                      country: partner.country,
                      companyWebsite: partner.companyWebsite,
                      companyAddress: partner.companyAddress,
                      industry: partner.industry,
                    });
                    setEditing(true);
                  }}
                  className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-slate-500 block">Owner</label>
                  <input
                    value={editFields.owner || ""}
                    onChange={(e) =>
                      setEditFields({ ...editFields, owner: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">Partner type</label>
                  <input
                    value={editFields.partnerType || ""}
                    onChange={(e) =>
                      setEditFields({
                        ...editFields,
                        partnerType: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">Country</label>
                  <input
                    value={editFields.country || ""}
                    onChange={(e) =>
                      setEditFields({ ...editFields, country: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">
                    Company Website
                  </label>
                  <input
                    value={editFields.companyWebsite || ""}
                    onChange={(e) =>
                      setEditFields({
                        ...editFields,
                        companyWebsite: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">
                    Company Address
                  </label>
                  <input
                    value={editFields.companyAddress || ""}
                    onChange={(e) =>
                      setEditFields({
                        ...editFields,
                        companyAddress: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                <span className="text-slate-500">Owner</span>
                <span className="font-medium text-slate-900">
                  {partner.owner || "—"}
                </span>

                <span className="text-slate-500">Partner program</span>
                <span className="font-medium text-blue-700">
                  {partner.programName || "—"}
                </span>

                <span className="text-slate-500">Partner type</span>
                <span className="font-medium text-slate-900">
                  {partner.partnerType || "—"}
                </span>

                <span className="text-slate-500">Active since</span>
                <span className="font-medium text-slate-900">
                  {partner.activeSince || "—"}
                </span>

                <span className="text-slate-500">Country</span>
                <span className="font-medium text-slate-900">
                  {partner.country || "—"}
                </span>

                <span className="text-slate-500">Currency / Language</span>
                <span className="font-medium text-slate-900">
                  {partner.currency} · {partner.language}
                </span>

                <span className="text-slate-500">Prospection stage</span>
                <span className="font-medium text-slate-900">
                  {partner.prospectionStage || "—"}
                </span>

                <span className="text-slate-500">Company Website</span>
                <span className="font-medium text-blue-600 truncate">
                  {partner.companyWebsite || "—"}
                </span>

                <span className="text-slate-500">Company Address</span>
                <span className="font-medium text-slate-900">
                  {partner.companyAddress || "—"}
                </span>

                <span className="text-slate-500">Business Industry</span>
                <span className="font-medium text-slate-900">
                  {partner.industry || "—"}
                </span>

                <span className="text-slate-500">Bank / SWIFT</span>
                <span className="font-medium text-slate-900">
                  {bankInfo.bankName
                    ? `${bankInfo.bankName}${
                        bankInfo.swiftCode ? ` (${bankInfo.swiftCode})` : ""
                      }`
                    : "Not provided"}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Main contact
            </h3>
            <p className="font-bold text-slate-900">
              {`${partner.contactFirstName || ""} ${
                partner.contactLastName || ""
              }`.trim() || "—"}
            </p>
            <p className="text-slate-600">{partner.contactJobTitle || "—"}</p>
            <p className="text-blue-600">{partner.contactEmail || "—"}</p>
            <p className="text-slate-500">{partner.contactPhone || "—"}</p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-1">
            {RIGHT_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === t
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            {activeTab === "Onboarding" && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Onboarding Pipeline: {partner.onboardingPipeline || "—"}
                    </h3>
                    <p className="text-slate-500">
                      Current Stage: {partner.onboardingStage || "—"} (
                      {partner.onboardingStatus})
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      mutate(
                        "UPDATE_PARTNER",
                        {
                          id: partner.id,
                          data: {
                            onboardingStatus: "Completed",
                            onboardingStage: "Completed",
                          },
                        },
                        "Partner onboarding marked Completed!"
                      )
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Complete Onboarding
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                  {[
                    "Kickoff",
                    "Enablement",
                    "Technical Certification",
                    "Completed",
                  ].map((step, i) => (
                    <div
                      key={step}
                      onClick={() =>
                        mutate(
                          "UPDATE_PARTNER",
                          {
                            id: partner.id,
                            data: {
                              onboardingStage: step,
                              onboardingStatus:
                                step === "Completed"
                                  ? "Completed"
                                  : "In progress",
                            },
                          },
                          `Moved onboarding to "${step}"`
                        )
                      }
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        partner.onboardingStage === step ||
                        partner.onboardingStatus === "Completed"
                          ? "border-blue-500 bg-blue-50/60"
                          : "border-slate-200 bg-slate-50 hover:border-blue-300"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-blue-700 uppercase">
                        Step {i + 1}
                      </span>
                      <p className="font-bold text-slate-900 mt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Dashboard" && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-slate-900">
                  Partner Performance Metrics (Last 365 Days)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-slate-600">Sourced Revenue</p>
                    <p className="text-lg font-extrabold text-blue-700 mt-1">
                      {baseCurrency}{" "}
                      {Number(partner.sourcedRevenue365d || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-slate-600">Influenced Revenue</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">
                      {baseCurrency}{" "}
                      {Number(partner.influencedRev365d || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-slate-600">Registered Deals</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">
                      {partnerDeals.length || partner.registeredDeals365d}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-slate-600">Submitted Leads</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">
                      {partnerLeads.length || partner.submittedLeads365d}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Account Mapping" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Account Overlaps with {partner.name}
                  </h3>
                  <Link
                    href="/account-mapping-overview"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Open Full Matrix →
                  </Link>
                </div>
                {partnerOverlaps.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {o.accountName}
                      </p>
                      <p className="text-slate-500">
                        Your {o.type} vs Partner {o.partnerAccountType} ·
                        Overlap date {o.overlapDate}
                      </p>
                    </div>
                    <StatusBadge status="Active" />
                  </div>
                ))}
              </div>
            )}

            {(activeTab === "Activities" ||
              activeTab === "Notes" ||
              activeTab === "Meetings" ||
              activeTab === "Tasks" ||
              activeTab === "Attachments") && (
              <NotesAndActivitiesTab
                entityType="partner"
                entityId={partner.id}
              />
            )}

            {activeTab === "Customize" && (
              <div className="space-y-3 text-xs">
                <h3 className="font-bold text-sm text-slate-900">
                  Customize Partner Portal &amp; Personal Lead Form
                </h3>
                <p className="text-slate-600">
                  Personal lead submission form link:{" "}
                  {partner.leadFormToken ? (
                    <Link
                      href={`/forms/lead/${partner.leadFormToken}`}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      /forms/lead/{partner.leadFormToken} ↗
                    </Link>
                  ) : (
                    <span>Not generated</span>
                  )}
                </p>
              </div>
            )}

            {activeTab === "Rewards" && (
              <div className="space-y-3 text-xs">
                <h3 className="font-bold text-sm text-slate-900">
                  Partner Rewards ({partnerRewards.length})
                </h3>
                {partnerRewards.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-blue-700">
                        {r.rewardNumber} · {r.fromActivity}
                      </p>
                      <p className="text-slate-500">{r.fromRewardRule}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold">
                        {baseCurrency}{" "}
                        {Number(r.amountBase || 0).toLocaleString()}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Links" && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-blue-900">
                      Personal Lead Submission Form (Rotatable Token)
                    </p>
                    <p className="font-mono text-blue-700 mt-0.5">
                      /forms/lead/{partner.leadFormToken || "(not generated)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      mutate(
                        "ROTATE_PARTNER_LEAD_TOKEN",
                        { partnerId: partner.id },
                        `Rotated lead-form token for ${partner.name}`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Rotate Lead-Form Token
                  </button>
                </div>

                <h3 className="font-bold text-sm text-slate-900 pt-2">
                  Referral Tracking Links
                </h3>
                {partnerLinks.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{l.name}</p>
                      <p className="text-blue-600">{l.targetUrl}</p>
                    </div>
                    <span className="font-semibold text-slate-700">
                      {l.uniqueVisitors} visitors · {l.leadsCount} leads
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Certifications" && (
              <div className="space-y-4 text-xs">
                <form
                  onSubmit={handleAwardCert}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-end gap-2"
                >
                  <div className="flex-1">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Award Certification from Manage &gt; Certifications
                    </label>
                    <select
                      value={selectedCertId}
                      onChange={(e) => setSelectedCertId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {allCertifications.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Award Certification</span>
                  </button>
                </form>

                <div className="space-y-2">
                  {allCertifications.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-slate-500">{c.subtitle}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Team" && (
              <div className="space-y-4 text-xs">
                <form
                  onSubmit={handleInviteMember}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
                >
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      required
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option>Manager</option>
                      <option>Sales Rep</option>
                      <option>Stakeholder</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Invite Member
                  </button>
                </form>

                <div className="space-y-2">
                  {partnerTeam.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{m.name}</p>
                        <p className="text-slate-500">
                          {m.email} · {m.jobTitle} ({m.role})
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
