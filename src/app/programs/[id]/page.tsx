"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { ProgramRuleModal } from "@/components/ProgramRuleModal";
import { describeRule, ruleFieldChoices, toEditableRule } from "@/lib/ruleEditing";
import { definitionsFromItems } from "@/lib/customFieldDefs";
import {
  StructuredRewardRule,
  SUPPORTED_CURRENCIES,
  normalizeRewardRule,
} from "@/lib/prmEngine";
import {
  Plus,
  Gift,
  Award,
  CheckCircle2,
  Shield,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";

const PROGRAM_TABS = [
  "Members",
  "Applications",
  "Links",
  "Levels",
  "Settings",
] as const;

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const {
    programs,
    partners,
    trackingLinks,
    manageItems,
    settings,
    loading,
    mutate,
    showToast,
    setGlobalModal,
  } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  // §1.4 & §3.5.1: Never fall back to a hardcoded ID or programs[0]
  const program = programs.find((p) => p.id === id);

  const [activeTab, setActiveTab] =
    useState<(typeof PROGRAM_TABS)[number]>("Levels");
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newLink, setNewLink] = useState({ name: "", targetUrl: "" });

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<string | null>(
    null
  );
  const [ruleForm, setRuleForm] = useState<StructuredRewardRule>({
    id: "",
    title: "",
    trigger: "new_transaction",
    conditions: [],
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 10,
    currency: baseCurrency,
    rateSteps: [],
    requiresValidation: true,
    clawbackOnRefund: true,
  });

  const [rejectPartnerId, setRejectPartnerId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reapplyAfterDate, setReapplyAfterDate] = useState("");

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading program...</div>;
  }

  if (!program) {
    return (
      <div className="max-w-xl mx-auto p-8 space-y-3">
        <BackBreadcrumb href="/programs/views/all" label="Programs" />
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Program not found</p>
          <p className="text-xs text-slate-500 mt-1">
            No program exists with ID <code>{id || "(empty)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let levels: any[] = [];
  try {
    levels = JSON.parse(program.levelsJson || "[]");
  } catch {
    levels = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let permissions: Record<string, Record<string, any>> = {};
  try {
    permissions = JSON.parse(program.permissionsJson || "{}");
  } catch {
    permissions = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let autoEmails: Record<string, any> = {};
  try {
    autoEmails = JSON.parse(program.autoEmailsJson || "{}");
  } catch {
    autoEmails = {};
  }

  const emailTemplates = manageItems.filter(
    (m) => m.category === "email_templates"
  );
  const commissionTemplateItems = manageItems.filter(
    (m) => m.category === "commission_templates"
  );
  const customFieldDefs = definitionsFromItems(manageItems, undefined, true);
  const fieldLabels = ruleFieldChoices(customFieldDefs).labels;
  const onboardingPipelines = manageItems.filter(
    (m) => m.category === "onboarding_pipelines"
  );

  const currentLevel = levels[selectedLevelIdx] || levels[0];
  const members = partners.filter(
    (p) => p.programId === program.id || p.programName === program.name
  );
  const pendingApps = partners.filter(
    (p) =>
      p.status === "Pending" &&
      (!p.programId || p.programId === program.id || p.programName === program.name)
  );
  const progLinks = trackingLinks.filter((l) => l.programId === program.id);

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleForm({
      id: `rule-${Date.now()}`,
      title: "",
      trigger: "new_transaction",
      conditions: [],
      valueType: "Cash",
      amountMode: "percentage",
      rateOrAmount: 10,
      currency: baseCurrency,
      rateSteps: [],
      requiresValidation: true,
      clawbackOnRefund: true,
    });
    setRuleModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditRuleModal = (rawRule: any) => {
    const norm = toEditableRule(rawRule, baseCurrency);
    setEditingRuleId(norm.id);
    setRuleForm(norm);
    setRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLevel) return;
    const existingRewards: StructuredRewardRule[] = (
      currentLevel.rewards || []
    ).map((r: unknown) => normalizeRewardRule(r, baseCurrency));

    const updatedRewards = editingRuleId
      ? existingRewards.map((r) => (r.id === editingRuleId ? ruleForm : r))
      : [...existingRewards, { ...ruleForm, id: `rule-${Date.now()}` }];

    const nextLevels = levels.map((lvl, idx) =>
      idx === selectedLevelIdx ? { ...lvl, rewards: updatedRewards } : lvl
    );

    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      editingRuleId
        ? `Updated commission rule "${ruleForm.title}"`
        : `Created structured commission rule "${ruleForm.title}"`
    );
    setRuleModalOpen(false);
    setEditingRuleId(null);
  };

  const handleSaveAsTemplate = async (rule: StructuredRewardRule) => {
    const tplTitle = rule.title.trim() || "Custom Commission Template";
    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "commission_templates",
        name: tplTitle,
        subtitle: describeRule(rule, baseCurrency, fieldLabels),
        status: "Active",
        metadata: {
          ...rule,
          id: `tpl-${Date.now()}`,
          title: tplTitle,
          currency: rule.currency || baseCurrency,
        },
      },
      `Saved "${tplTitle}" to editable commission templates!`
    );
  };

  const handleDeleteTemplate = async (templateItemId: string) => {
    await mutate(
      "DELETE_MANAGE_ITEM",
      { id: templateItemId },
      "Removed commission template"
    );
  };

  const handleConfirmDeleteRule = async () => {
    if (!currentLevel || !deleteConfirmRuleId) return;
    const nextRewards = (currentLevel.rewards || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.id !== deleteConfirmRuleId
    );
    const nextLevels = levels.map((lvl, idx) =>
      idx === selectedLevelIdx ? { ...lvl, rewards: nextRewards } : lvl
    );
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      "Commission reward rule deleted"
    );
    setDeleteConfirmRuleId(null);
  };

  const handleAddLevel = async () => {
    const nextLevels = [
      ...levels,
      {
        id: `lvl-${Date.now()}`,
        name: `Tier Level ${levels.length + 1}`,
        badgeColor: "blue",
        rewards: [],
        benefits: [{ id: `b-${Date.now()}`, title: "Co-Selling Support" }],
        requirements: [
          {
            id: `req-${Date.now()}`,
            metric: "Minimum annual revenue",
            target: `${baseCurrency} 50,000`,
          },
        ],
      },
    ];
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      "New program tier level added!"
    );
    setSelectedLevelIdx(nextLevels.length - 1);
  };

  const handleTogglePermission = async (
    groupName: string,
    permLabel: string,
    roleKey: "Manager" | "SalesRep" | "Stakeholder"
  ) => {
    const nextPerms = {
      ...permissions,
      [groupName]: {
        ...(permissions[groupName] || {}),
        [permLabel]: {
          ...(permissions[groupName]?.[permLabel] || {}),
          [roleKey]: !permissions[groupName]?.[permLabel]?.[roleKey],
        },
      },
    };
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { permissionsJson: JSON.stringify(nextPerms) } },
      `Updated "${permLabel}" permission for ${roleKey}`
    );
  };

  const handleSelectEmailTemplate = async (
    triggerKey: string,
    templateName: string
  ) => {
    const nextAuto = {
      ...autoEmails,
      [triggerKey]: templateName,
    };
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { autoEmailsJson: JSON.stringify(nextAuto) } },
      `Updated ${triggerKey}`
    );
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.name || !newLink.targetUrl) return;
    await mutate(
      "CREATE_TRACKING_LINK",
      {
        name: newLink.name,
        targetUrl: newLink.targetUrl,
        programId: program.id,
      },
      "Partner referral tracking link created!"
    );
    setNewLink({ name: "", targetUrl: "" });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/programs/views/all" label="Programs" />
          <div className="flex items-center space-x-3 pt-1">
            {renaming ? (
              <form
                className="flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await mutate(
                    "UPDATE_PROGRAM",
                    { id: program.id, data: { name: renameValue } },
                    `Program renamed to "${renameValue.trim()}"`
                  );
                  if (res) setRenaming(false);
                }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-lg text-base font-bold"
                />
                <button type="submit" className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <h1 className="text-xl font-bold text-slate-900">{program.name}</h1>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {levels.length} Tier Levels
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/forms/apply/${program.id}`}
            className="px-3.5 py-2 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Public Application Form</span>
          </Link>
          <button
            onClick={async () => {
              const res = await mutate(
                "DUPLICATE_PROGRAM",
                { id: program.id },
                `Duplicated program "${program.name}"!`
              );
              if (res?.program?.id) {
                router.push(`/programs/${res.program.id}`);
              }
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => {
              setRenameValue(program.name);
              setRenaming(true);
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            Rename
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              About this program
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500"># of partners (computed)</span>
              <span className="font-bold text-slate-900">{members.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Owner</span>
              <span className="font-medium text-slate-900">
                {program.owner || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Onboarding pipeline</span>
              <span className="font-medium text-blue-700">
                {program.onboardingPipelineId || "—"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Automated emails (Template per trigger)
            </h3>
            {[
              {
                key: "acknowledgeSignupTemplate",
                label: "Acknowledge partner signup",
              },
              {
                key: "notifyAcceptedTemplate",
                label: "Notify accepted partner (with activation link)",
              },
              {
                key: "notifyRejectedTemplate",
                label: "Notify rejected partner",
              },
            ].map((trig) => (
              <div key={trig.key} className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  {trig.label}
                </label>
                <select
                  value={autoEmails[trig.key] || "Disabled"}
                  onChange={(e) =>
                    handleSelectEmailTemplate(trig.key, e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-medium text-blue-700"
                >
                  <option value="Disabled">Disabled (Do not send)</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      Template: {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Terms &amp; Conditions
            </h3>
            <p className="text-slate-600">
              Require partners to accept T&amp;Cs:{" "}
              <strong className="text-blue-700">
                {program.termsRequired ? "Yes" : "No"}
              </strong>
            </p>
            <p className="text-blue-600 truncate">
              {program.termsUrl || "No terms URL configured"}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Metrics
            </h3>
            <p className="text-slate-500">Revenue computation strategy:</p>
            <p className="font-bold text-slate-900">
              {program.revenueStrategy || "Closed won deals"}
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-1">
            {PROGRAM_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === t
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
                {t === "Applications" && ` (${pendingApps.length})`}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-xs">
            {activeTab === "Members" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Program Members ({members.length})
                  </h3>
                  <button
                    onClick={() => setGlobalModal("add_partner")}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Add partner to program
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {members.length === 0 ? (
                    <p className="py-6 text-center text-slate-400">
                      No partners enrolled in this program yet.
                    </p>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.id}
                        className="py-3 flex items-center justify-between"
                      >
                        <div>
                          <Link
                            href={`/partners/${m.id}`}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {m.name}
                          </Link>
                          <p className="text-slate-500">
                            {m.qualifyingLevel || "Standard"} · Active since{" "}
                            {m.activeSince || "—"} · Sourced {baseCurrency}{" "}
                            {Number(m.sourcedRevenue365d || 0).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "Applications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Pending Applications ({pendingApps.length})
                    </h3>
                    <p className="text-slate-500">
                      Accept as Prospect or Active Partner, or Reject with
                      required reason.
                    </p>
                  </div>
                  <Link
                    href={`/forms/apply/${program.id}`}
                    className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 font-semibold"
                  >
                    Open Public Application Form →
                  </Link>
                </div>

                {pendingApps.length === 0 ? (
                  <p className="text-slate-500 py-6 text-center">
                    No pending applications.
                  </p>
                ) : (
                  pendingApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {app.name}
                        </p>
                        <p className="text-slate-600">
                          Contact: {app.contactFirstName} {app.contactLastName} (
                          {app.contactEmail})
                          {app.country ? ` · ${app.country}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            mutate(
                              "REVIEW_PARTNER_APPLICATION",
                              {
                                partnerId: app.id,
                                programId: program.id,
                                mode: "accept_prospect",
                              },
                              `Accepted "${app.name}" as Prospect`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold"
                        >
                          Accept as Prospect
                        </button>
                        <button
                          onClick={() =>
                            mutate(
                              "REVIEW_PARTNER_APPLICATION",
                              {
                                partnerId: app.id,
                                programId: program.id,
                                mode: "accept_active",
                              },
                              `Accepted "${app.name}" as Active Partner & sent activation link!`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        >
                          Accept as Active Partner
                        </button>
                        <button
                          onClick={() => {
                            setRejectPartnerId(app.id);
                            setRejectionReason("");
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-500 text-amber-800 hover:bg-amber-50 font-semibold"
                        >
                          Reject...
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "Links" && (
              <div className="space-y-4">
                <form
                  onSubmit={handleCreateLink}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
                >
                  <div className="flex-1 min-w-[180px]">
                    <label className="block font-medium text-slate-700 mb-1">
                      Link Name
                    </label>
                    <input
                      value={newLink.name}
                      onChange={(e) =>
                        setNewLink({ ...newLink, name: e.target.value })
                      }
                      placeholder="Partner Referral Landing Page"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="block font-medium text-slate-700 mb-1">
                      Target URL
                    </label>
                    <input
                      value={newLink.targetUrl}
                      onChange={(e) =>
                        setNewLink({ ...newLink, targetUrl: e.target.value })
                      }
                      placeholder="https://example.com/offer"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Add link
                  </button>
                </form>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Name</th>
                      <th className="py-2">Target URL</th>
                      <th className="py-2 text-right">Unique visitors</th>
                      <th className="py-2 text-right">Leads</th>
                      <th className="py-2 text-right">Customers</th>
                      <th className="py-2 text-right">Transactions</th>
                      <th className="py-2 text-right">Revenues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progLinks.map((lnk) => (
                      <tr key={lnk.id}>
                        <td className="py-2.5 font-bold text-slate-900">
                          {lnk.name}
                        </td>
                        <td className="py-2.5 text-blue-600">
                          {lnk.targetUrl}
                        </td>
                        <td className="py-2.5 text-right">
                          {lnk.uniqueVisitors}
                        </td>
                        <td className="py-2.5 text-right">{lnk.leadsCount}</td>
                        <td className="py-2.5 text-right">
                          {lnk.customersCount}
                        </td>
                        <td className="py-2.5 text-right">
                          {lnk.transactionsCount}
                        </td>
                        <td className="py-2.5 text-right font-bold">
                          {baseCurrency}{" "}
                          {Number(lnk.revenuesBase || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "Levels" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                  {levels.map((lvl, idx) => (
                    <button
                      key={lvl.id}
                      onClick={() => setSelectedLevelIdx(idx)}
                      className={`px-3.5 py-1.5 rounded-lg font-bold border ${
                        selectedLevelIdx === idx
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {lvl.name}
                    </button>
                  ))}
                  <button
                    onClick={handleAddLevel}
                    className="px-3 py-1.5 rounded-lg border border-dashed border-blue-400 text-blue-600 font-semibold hover:bg-blue-50 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add new level</span>
                  </button>
                </div>

                {currentLevel && (
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                          <Gift className="w-4 h-4 text-blue-600" />
                          <span>
                            Structured Commission Rules (
                            {currentLevel.rewards?.length || 0})
                          </span>
                        </div>
                        <button
                          onClick={openCreateRuleModal}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add reward</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(currentLevel.rewards || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (rawR: any) => {
                            const r = normalizeRewardRule(rawR, baseCurrency);
                            return (
                              <div
                                key={r.id}
                                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-wrap items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <p className="font-bold text-slate-900 text-sm">
                                      {r.title}
                                    </p>
                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                                      {r.valueType}
                                    </span>
                                  </div>
                                  <p className="text-slate-700">{describeRule(r, baseCurrency, fieldLabels)}</p>
                                  {r.description && <p className="text-slate-500 text-[11px]">{r.description}</p>}
                                  <p className="text-slate-500 text-[11px]">
                                    {r.requiresValidation ? "Needs admin validation" : "Validated automatically"} ·{" "}
                                    {r.clawbackOnRefund ? "Reversed if refunded" : "Not reversed on refund"}
                                  </p>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold">
                                    {r.amountMode === "percentage"
                                      ? r.rateSteps && r.rateSteps.length > 0
                                        ? r.rateSteps.map((st) => `${st.ratePct}%`).join(" → ")
                                        : `${r.rateOrAmount}%`
                                      : r.amountMode ===
                                        "one_month_subscription"
                                      ? "1 Month Fee"
                                      : `${r.currency || baseCurrency} ${
                                          r.rateOrAmount
                                        }`}
                                  </span>
                                  <button
                                    onClick={() => openEditRuleModal(r)}
                                    className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center space-x-1"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmRuleId(r.id)}
                                    className="px-2 py-1 rounded border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold flex items-center space-x-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                        <Award className="w-4 h-4 text-blue-600" />
                        <span>Benefits</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(currentLevel.benefits || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (b: any) => (
                            <div
                              key={b.id}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
                            >
                              ✓ {b.title}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Requirements</span>
                      </div>
                      <div className="space-y-2">
                        {(currentLevel.requirements || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (req: any) => (
                            <div
                              key={req.id}
                              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                            >
                              <span className="text-slate-700 font-medium">
                                {req.metric}
                              </span>
                              <span className="font-bold text-blue-700">
                                {req.target}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Settings" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Program Onboarding Pipeline &amp; Payout Schedule
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Assigned Onboarding Pipeline
                      </label>
                      {onboardingPipelines.length > 0 ? (
                        <select
                          value={program.onboardingPipelineId || ""}
                          onChange={(e) =>
                            mutate(
                              "UPDATE_PROGRAM",
                              {
                                id: program.id,
                                data: { onboardingPipelineId: e.target.value },
                              },
                              `Assigned onboarding pipeline "${e.target.value}"`
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        >
                          {onboardingPipelines.map((pl) => (
                            <option key={pl.id} value={pl.name}>
                              {pl.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          defaultValue={program.onboardingPipelineId || ""}
                          onBlur={(e) =>
                            mutate(
                              "UPDATE_PROGRAM",
                              {
                                id: program.id,
                                data: { onboardingPipelineId: e.target.value },
                              },
                              "Updated onboarding pipeline"
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Payout Cadence
                      </label>
                      <select
                        value={String(autoEmails.payoutCadence || "quarterly")}
                        onChange={(e) =>
                          handleSelectEmailTemplate(
                            "payoutCadence",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Minimum Payout Threshold ({baseCurrency})
                      </label>
                      <input
                        type="number"
                        defaultValue={Number(
                          autoEmails.payoutThresholdBase ?? 250
                        )}
                        onBlur={(e) =>
                          handleSelectEmailTemplate(
                            "payoutThresholdBase",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>
                    Role-Based Partner Portal Permissions (Enforced Live in /p)
                  </span>
                </div>

                {Object.entries(permissions).map(([groupName, rules]) => (
                  <div key={groupName} className="space-y-2">
                    <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[11px]">
                      {groupName}
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-2 px-3">Permission</th>
                            <th className="py-2 px-3 text-center">Manager</th>
                            <th className="py-2 px-3 text-center">Sales Rep</th>
                            <th className="py-2 px-3 text-center">
                              Stakeholder
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(rules).map(([permLabel, roles]) => (
                            <tr key={permLabel}>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {permLabel}
                              </td>
                              {(
                                ["Manager", "SalesRep", "Stakeholder"] as const
                              ).map((rKey) => (
                                <td key={rKey} className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(roles[rKey])}
                                    onChange={() =>
                                      handleTogglePermission(
                                        groupName,
                                        permLabel,
                                        rKey
                                      )
                                    }
                                    className="rounded text-blue-600 cursor-pointer"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProgramRuleModal
        open={ruleModalOpen}
        editingRuleId={editingRuleId}
        ruleForm={ruleForm}
        setRuleForm={setRuleForm}
        baseCurrency={baseCurrency}
        commissionTemplateItems={commissionTemplateItems}
        onClose={() => setRuleModalOpen(false)}
        onSaveRule={handleSaveRule}
        onSaveAsTemplate={handleSaveAsTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        customFieldDefs={customFieldDefs}
      />

      {deleteConfirmRuleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">
              Delete Commission Rule?
            </h3>
            <p className="text-slate-600">
              Are you sure you want to remove this commission rule from{" "}
              <strong>{currentLevel?.name}</strong>?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setDeleteConfirmRuleId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRule}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectPartnerId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectionReason.trim()) return;
              await mutate(
                "REVIEW_PARTNER_APPLICATION",
                {
                  partnerId: rejectPartnerId,
                  programId: program.id,
                  mode: "reject",
                  rejectionReason,
                  reapplyAfterDate,
                },
                "Partner application rejected with reason"
              );
              setRejectPartnerId(null);
            }}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Reject Partner Application (Reason Required)
              </h3>
              <button type="button" onClick={() => setRejectPartnerId(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rejection Reason (sent in rejection email) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State the reason for declining this application..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Eligible to re-apply after (optional)
                </label>
                <input
                  type="date"
                  value={reapplyAfterDate}
                  onChange={(e) => setReapplyAfterDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectPartnerId(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
