"use client";

import React, { useState } from "react";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";
import { ManageFormState, ManageModals } from "@/components/ManageModals";
import { ManageEmailAndHelpPanels } from "@/components/ManageEmailAndHelpPanels";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import {
  FolderOpen,
  Award,
  MailCheck,
  FileText,
  Users,
  BookOpen,
  Puzzle,
  Newspaper,
  LayoutDashboard,
  Globe,
  GitBranch,
  Package,
  UserCheck,
  Workflow,
  Plus,
  Bell,
  Download,
  Edit3,
  Trash2,
  Play,
  Paperclip,
  Calculator,
} from "lucide-react";

const MANAGE_MODULES = [
  { id: "assets", title: "Assets", desc: "Upload & share docs, contracts & training videos with partners", icon: FolderOpen, cta: "Add asset" },
  { id: "certifications", title: "Certifications", desc: "Manage partner certifications, exams, validity & awards", icon: Award, cta: "New certification" },
  { id: "commission_templates", title: "Commission templates", desc: "Create & edit reusable commission rule templates for programs", icon: Calculator, cta: "New template" },
  { id: "email_setup", title: "Email setup", desc: "Custom domain CNAMEs & environment SMTP connector status", icon: MailCheck, cta: "Email Setup" },
  { id: "email_templates", title: "Email templates", desc: "Edit subject, merge tags, body & test-send templates", icon: FileText, cta: "Add a new template" },
  { id: "groups", title: "Groups", desc: "Segment partners, assign members & compare live KPIs", icon: Users, cta: "Add a new group" },
  { id: "help_articles", title: "Help Center", desc: "Manage Partner Portal Articles & Collections with attachments", icon: BookOpen, cta: "Add article" },
  { id: "integrations", title: "Integrations", desc: "Configure API keys, webhooks & sync connectors", icon: Puzzle, cta: "Add custom integration" },
  { id: "news", title: "News", desc: "Publish announcements & attachments to the Partner Portal", icon: Newspaper, cta: "Add news" },
  { id: "partner_dashboards", title: "Partner dashboards", desc: "Configure widgets & layout for the Partner Portal", icon: LayoutDashboard, cta: "New dashboard" },
  { id: "directories", title: "Partner directories", desc: "Configure & preview your searchable partner directory", icon: Globe, cta: "Add directory profile" },
  { id: "onboarding_pipelines", title: "Partner onboarding", desc: "Build & edit multi-stage onboarding Kanban pipelines", icon: GitBranch, cta: "New pipeline" },
  { id: "products", title: "Products", desc: "Manage product SKUs, pricing & spec sheets for deal line items", icon: Package, cta: "Add new product" },
  { id: "team", title: "Team", desc: "Invite & edit internal coworkers, roles & email invites", icon: UserCheck, cta: "Add coworker" },
  { id: "workflows", title: "Workflows", desc: "Build & test automated trigger-condition-action rules", icon: Workflow, cta: "New workflow" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMeta(jsonStr?: string): Record<string, any> {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

function normalizeFileUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    return `/api/files/${url.replace(/^\/uploads\//, "")}`;
  }
  return url;
}

export default function ManageHubPage() {
  const {
    manageItems,
    partners,
    programs,
    leads,
    deals,
    settings,
    session,
    mutate,
    showToast,
    refresh,
  } = usePrm();
  const [selectedTool, setSelectedTool] = useState<string>("assets");
  const [assetFolder, setAssetFolder] = useState<string>("All");
  const [helpSubTab, setHelpSubTab] = useState<"Articles" | "Collections">(
    "Articles"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];
  const workspaceSlug = acct.workspaceSlug || "workspace";

  const [form, setForm] = useState<ManageFormState>({
    name: "",
    subtitle: "",
    status: "Active",
    fileName: "",
    fileUrl: "",
    fileSize: "",
    mimeType: "",
    folder: "Sales Collateral",
    programVisibility: "All Programs",
    validityMonths: "24",
    passingScore: "85%",
    awardedPartners: [],
    emailSubject: "Welcome to {{workspace.name}}, {{partner.name}}!",
    emailTrigger: "On partner signup",
    emailBody:
      "Hi {{contact.first_name}},\n\nWelcome to {{program.name}} at {{workspace.name}}! Your partner portal is ready.\n\nBest regards,\n{{workspace.name}}",
    groupPartnerIds: [],
    collection: "Getting Started for Partners",
    articleBody: "",
    apiKey: "",
    webhookUrl: "",
    syncDirection: "Bi-directional (Real-time)",
    sku: "",
    priceBase: "",
    billingCadence: "Annual License",
    coworkerEmail: "",
    coworkerTitle: "",
    coworkerPhone: "",
    coworkerRole: "Manager",
    workflowTrigger: "Deal Stage moves to Closed Won",
    workflowCondition: "status == Active",
    workflowAction: "create_task: Follow up on partner milestone",
    conditionField: "status",
    conditionOperator: "equals",
    conditionValue: "Active",
    actionType: "create_task",
    actionTarget: "Follow up on partner milestone",
    pipelineStages: "Kickoff, Enablement, Active",
    dashboardWidgets: [
      "Quick Deal Registration",
      "Submit Lead Form",
      "Commission & Payout Tracker",
      "Enablement Assets Library",
    ],
  });

  const [awardModalCertId, setAwardModalCertId] = useState<string | null>(null);
  const [selectedPartnerToAward, setSelectedPartnerToAward] =
    useState<string>("");

  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyTargetEmail, setNotifyTargetEmail] = useState("");
  const [notifyMessage, setNotifyMessage] = useState(
    "New enablement assets are now available in your {{workspace.name}} Partner Portal."
  );

  const emailConnectorStatus = settings.email_connector_status || {
    driver: "local",
    smtpConfigured: false,
    smtpHost: null,
    smtpPort: null,
  };
  const [emailDomain, setEmailDomain] = useState(`@${workspaceSlug}.local`);
  const [emailPrefix, setEmailPrefix] = useState("partners");
  const [testEmailRecipient, setTestEmailRecipient] = useState("");

  const activeMod =
    MANAGE_MODULES.find((m) => m.id === selectedTool) || MANAGE_MODULES[0];
  const items = manageItems.filter((i) => i.category === selectedTool);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...form,
      name: "",
      subtitle: "",
      status:
        selectedTool === "assets" ||
        selectedTool === "news" ||
        selectedTool === "help_articles"
          ? "Published"
          : "Active",
      fileName: "",
      fileUrl: "",
      fileSize: "",
      mimeType: "",
      sku: "",
      priceBase: "",
      coworkerEmail: "",
      coworkerTitle: "",
      coworkerPhone: "",
      apiKey: "",
      webhookUrl: "",
      articleBody: "",
      conditionField: "status",
      conditionOperator: "equals",
      conditionValue: "Active",
      actionType: "create_task",
      actionTarget: "Follow up with Partner Manager",
    });
    setModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditModal = (item: any) => {
    const meta = parseMeta(item.metadataJson);
    const sc = meta.structuredCondition || {};
    const sa = meta.structuredAction || {};
    setEditingId(item.id);
    setForm({
      ...form,
      name: item.name || "",
      subtitle: item.subtitle || "",
      status: item.status || "Active",
      fileName: meta.fileName || "",
      fileUrl: normalizeFileUrl(meta.fileUrl),
      fileSize: meta.fileSize || "",
      mimeType: meta.mimeType || "",
      folder: meta.folder || "Sales Collateral",
      programVisibility: meta.programVisibility || "All Programs",
      validityMonths: String(meta.validityMonths || "24"),
      passingScore: meta.passingScore || "85%",
      awardedPartners: Array.isArray(meta.awardedPartners)
        ? meta.awardedPartners
        : [],
      emailSubject:
        meta.emailSubject ||
        item.subtitle?.replace(/^Subject:\s*/i, "") ||
        `Update regarding ${item.name}`,
      emailTrigger: meta.trigger || "On partner lifecycle event",
      emailBody:
        meta.emailBody ||
        `Hi {{contact.first_name}},\n\nThis is an automated notification for "${item.name}".\n\nBest regards,\n{{workspace.name}}`,
      groupPartnerIds: partners
        .filter((p) => p.groupName === item.name)
        .map((p) => p.id),
      collection: meta.collection || "Getting Started for Partners",
      articleBody: meta.articleBody || "",
      apiKey: meta.apiKey || "",
      webhookUrl: meta.webhookUrl || "",
      syncDirection: meta.syncDirection || "Bi-directional (Real-time)",
      sku: meta.sku || "",
      priceBase: String(meta.priceBase ?? meta.price ?? ""),
      billingCadence: meta.billingCadence || "Annual License",
      coworkerEmail: meta.email || "",
      coworkerTitle: meta.jobTitle || "",
      coworkerPhone: meta.phone || "",
      coworkerRole: meta.role || item.status || "Manager",
      workflowTrigger: meta.trigger || "Deal Stage moves to Closed Won",
      workflowCondition: meta.condition || "status == Active",
      workflowAction: meta.action || "create_task: Follow up",
      conditionField: sc.field || "status",
      conditionOperator: sc.operator || "equals",
      conditionValue: sc.value || "Active",
      actionType: sa.type || "create_task",
      actionTarget: sa.target || item.name,
      pipelineStages: Array.isArray(meta.stages)
        ? meta.stages.join(", ")
        : "Kickoff, Enablement, Active",
      dashboardWidgets: Array.isArray(meta.dashboardWidgets)
        ? meta.dashboardWidgets
        : [
            "Quick Deal Registration",
            "Submit Lead Form",
            "Commission & Payout Tracker",
            "Enablement Assets Library",
          ],
    });
    setModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (json.ok) {
        setForm((prev) => ({
          ...prev,
          name: prev.name || json.fileName,
          fileName: json.fileName,
          fileUrl: json.fileUrl,
          fileSize: json.fileSize,
          mimeType: json.mimeType,
        }));
        showToast(`Attached file "${json.fileName}" (${json.fileSize})`);
      } else {
        showToast(json.error || "File upload rejected");
      }
    } catch (err) {
      console.error(err);
      showToast("File upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const structuredCondition = {
      field: form.conditionField,
      operator: form.conditionOperator,
      value: form.conditionValue,
    };
    const structuredAction = {
      type: form.actionType,
      target: form.actionTarget,
    };

    let computedSubtitle = form.subtitle;
    if (selectedTool === "assets") {
      computedSubtitle = `${form.folder}${
        form.fileSize ? ` · ${form.fileSize}` : ""
      } · ${form.programVisibility}${
        form.fileName ? ` · Attached: ${form.fileName}` : ""
      }`;
    } else if (selectedTool === "certifications") {
      computedSubtitle = `Validity period: ${form.validityMonths} Months · Passing Score: ${form.passingScore} · ${form.awardedPartners.length} Certified Partners`;
    } else if (selectedTool === "email_templates") {
      computedSubtitle = `Subject: ${form.emailSubject}`;
    } else if (selectedTool === "help_articles") {
      computedSubtitle = `Collection: ${form.collection} · ${
        form.fileName ? `Attachment: ${form.fileName}` : "Published"
      }`;
    } else if (selectedTool === "products") {
      computedSubtitle = `SKU: ${form.sku} · ${form.billingCadence} (${baseCurrency} ${Number(
        form.priceBase || 0
      ).toLocaleString()})`;
    } else if (selectedTool === "team") {
      computedSubtitle = `${form.coworkerEmail}${
        form.coworkerTitle ? ` · ${form.coworkerTitle}` : ""
      }${form.coworkerPhone ? ` · ${form.coworkerPhone}` : ""}`;
    } else if (selectedTool === "workflows") {
      computedSubtitle = `WHEN ${form.workflowTrigger} IF ${structuredCondition.field} ${structuredCondition.operator} ${structuredCondition.value} THEN ${structuredAction.type} (${structuredAction.target})`;
    } else if (selectedTool === "onboarding_pipelines") {
      const stagesArr = form.pipelineStages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      computedSubtitle = `${stagesArr.length} Stages: ${stagesArr.join(" → ")}`;
    } else if (selectedTool === "partner_dashboards") {
      computedSubtitle = `Widgets (${form.dashboardWidgets.length}): ${form.dashboardWidgets.join(", ")}`;
    }

    const existingItem = editingId
      ? items.find((it) => it.id === editingId)
      : null;
    const existingMeta = existingItem
      ? parseMeta(existingItem.metadataJson)
      : {};

    const metadata =
      selectedTool === "commission_templates"
        ? {
            id: existingMeta.id || `tpl-${Date.now()}`,
            title: form.name,
            trigger: existingMeta.trigger || "transaction_paid",
            valueType: existingMeta.valueType || "Cash",
            amountMode: existingMeta.amountMode || "percentage",
            rateOrAmount: Number(existingMeta.rateOrAmount ?? 10),
            currency: existingMeta.currency || baseCurrency,
            duration: existingMeta.duration || "recurring",
            startOffsetMonths: Number(existingMeta.startOffsetMonths ?? 1),
            durationMonths: Number(existingMeta.durationMonths ?? 12),
            rateSteps: existingMeta.rateSteps || [],
            conditions: existingMeta.conditions || [],
            requiresValidation: Boolean(
              existingMeta.requiresValidation ?? true
            ),
            clawbackOnRefund: Boolean(existingMeta.clawbackOnRefund ?? true),
          }
        : {
            fileName: form.fileName,
            fileUrl: normalizeFileUrl(form.fileUrl),
            fileSize: form.fileSize,
            mimeType: form.mimeType,
            folder: form.folder,
            programVisibility: form.programVisibility,
            validityMonths: Number(form.validityMonths) || 24,
            passingScore: form.passingScore,
            awardedPartners: form.awardedPartners,
            emailSubject: form.emailSubject,
            trigger:
              selectedTool === "workflows"
                ? form.workflowTrigger
                : form.emailTrigger,
            emailBody: form.emailBody,
            collection: form.collection,
            articleBody: form.articleBody,
            apiKey: form.apiKey,
            webhookUrl: form.webhookUrl,
            syncDirection: form.syncDirection,
            sku: form.sku,
            priceBase: Number(form.priceBase) || 0,
            billingCadence: form.billingCadence,
            email: form.coworkerEmail,
            jobTitle: form.coworkerTitle,
            phone: form.coworkerPhone,
            role: form.coworkerRole,
            condition: `${structuredCondition.field} ${structuredCondition.operator} ${structuredCondition.value}`,
            action: `${structuredAction.type}: ${structuredAction.target}`,
            structuredCondition,
            structuredAction,
            stages: form.pipelineStages
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            dashboardWidgets: form.dashboardWidgets,
            partnersCount:
              selectedTool === "groups"
                ? form.groupPartnerIds.length
                : undefined,
          };

    if (editingId) {
      await mutate(
        "UPDATE_MANAGE_ITEM",
        {
          id: editingId,
          name: form.name,
          subtitle: computedSubtitle,
          status: selectedTool === "team" ? form.coworkerRole : form.status,
          metadata,
        },
        `Updated "${form.name}" in ${activeMod.title}!`
      );
    } else {
      await mutate(
        "CREATE_MANAGE_ITEM",
        {
          category: selectedTool,
          name: form.name,
          subtitle: computedSubtitle,
          status: selectedTool === "team" ? form.coworkerRole : form.status,
          metadata,
        },
        `Created "${form.name}" in ${activeMod.title}!`
      );
    }

    if (selectedTool === "groups" && form.groupPartnerIds.length > 0) {
      await mutate("ASSIGN_GROUP_PARTNERS", {
        groupName: form.name,
        partnerIds: form.groupPartnerIds,
      });
    }

    if (selectedTool === "team" && !editingId && form.coworkerEmail) {
      const inviter = session?.name || "An administrator";
      await mutate("SEND_EMAIL", {
        to: form.coworkerEmail,
        subject: `You've been invited to {{workspace.name}} as ${form.coworkerRole}`,
        body: `Hi ${form.name},\n\n${inviter} invited you to join {{workspace.name}} as a ${form.coworkerRole}${
          form.coworkerTitle ? ` (${form.coworkerTitle})` : ""
        }.\n\nBest regards,\n{{workspace.name}}`,
        templateName: "Coworker Invitation",
      });
    }

    setModalOpen(false);
    setEditingId(null);
  };

  const handleAwardCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    const cert = items.find((i) => i.id === awardModalCertId);
    const partnerTarget = selectedPartnerToAward || partners[0]?.name || "";
    if (!cert || !partnerTarget) return;
    const meta = parseMeta(cert.metadataJson);
    const currentList: string[] = Array.isArray(meta.awardedPartners)
      ? meta.awardedPartners
      : [];
    const updatedList = Array.from(new Set([...currentList, partnerTarget]));

    await mutate(
      "UPDATE_MANAGE_ITEM",
      {
        id: cert.id,
        name: cert.name,
        subtitle: `Validity period: ${meta.validityMonths || 24} Months · Passing Score: ${
          meta.passingScore || "85%"
        } · ${updatedList.length} Certified Partners`,
        metadata: {
          ...meta,
          awardedPartners: updatedList,
        },
      },
      `Awarded "${cert.name}" to ${partnerTarget}!`
    );
    setAwardModalCertId(null);
  };

  const handleRunWorkflowNow = async (
    workflowId: string,
    workflowName: string
  ) => {
    try {
      const res = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: "custom_workflows", workflowId }),
      });
      const json = await res.json();
      await refresh();
      if (json.ok) {
        showToast(`Executed workflow "${workflowName}" via durable scheduler!`);
      } else {
        showToast(json.error || "Failed to execute workflow");
      }
    } catch {
      showToast("Error executing workflow");
    }
  };

  const handleSendTestEmail = async () => {
    const recipient = testEmailRecipient || session?.email || "";
    if (!recipient) {
      showToast("Enter a recipient email address first.");
      return;
    }
    const res = await mutate("SEND_EMAIL", {
      to: recipient,
      subject: "{{workspace.name}} Test Email — Partner Portal & SMTP Verification",
      body: `Hello,\n\nThis is a live test email from {{workspace.name}} (${emailPrefix}${emailDomain}).\n\nBest regards,\n{{workspace.name}}`,
      templateName: "SMTP Verification Test",
      portalLink: "/p",
    });
    showToast(
      res?.deliveryMode || "Test email sent & logged to In-App Outbox!"
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Manage Workspace &amp; Partner Portal
        </h1>
        <p className="text-xs text-slate-500">
          Enablement assets, commission templates, certifications, email
          templates, onboarding pipelines, workflows &amp; team settings
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3">
        {MANAGE_MODULES.map((m) => {
          const Icon = m.icon;
          const active = selectedTool === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedTool(m.id)}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-md"
                  : "border-slate-200 bg-white hover:border-blue-300 text-slate-800"
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-2 ${
                  active ? "text-white" : "text-blue-600"
                }`}
              />
              <div>
                <p className="font-bold text-xs leading-snug">{m.title}</p>
                <p
                  className={`text-[10px] mt-0.5 line-clamp-2 ${
                    active ? "text-blue-100" : "text-slate-500"
                  }`}
                >
                  {m.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeMod.title}
            </h2>
            <p className="text-xs text-slate-500">{activeMod.desc}</p>
          </div>

          <div className="flex items-center space-x-2">
            {selectedTool === "assets" && (
              <button
                onClick={() => setNotifyModalOpen(true)}
                className="px-3 py-2 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notify partners about changes</span>
              </button>
            )}
            {selectedTool === "workflows" && (
              <button
                onClick={() =>
                  mutate(
                    "CREATE_MANAGE_ITEM",
                    {
                      category: "workflows",
                      name: "Auto-Create Review Task When Partner Status Becomes Active",
                      subtitle:
                        "WHEN Partner Properties Changed IF status equals Active THEN create_task (Schedule QBR)",
                      status: "Active",
                      metadata: {
                        trigger: "Partner Properties Changed",
                        condition: "status equals Active",
                        action: "create_task: Schedule QBR",
                        structuredCondition: {
                          field: "status",
                          operator: "equals",
                          value: "Active",
                        },
                        structuredAction: {
                          type: "create_task",
                          target: "Schedule QBR",
                        },
                        runs: 0,
                      },
                    },
                    "Structured workflow created!"
                  )
                }
                className="px-3 py-2 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold"
              >
                New from template
              </button>
            )}
            {selectedTool !== "email_setup" && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{activeMod.cta}</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. ASSETS */}
        {selectedTool === "assets" && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {[
                "All",
                "Sales Collateral",
                "Contracts",
                "Technical Enablement",
                "Brand Guidelines",
              ].map((fld) => (
                <button
                  key={fld}
                  onClick={() => setAssetFolder(fld)}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    assetFolder === fld
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {fld === "All" ? "All Folders" : fld}
                </button>
              ))}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4">Asset Name</th>
                    <th className="py-3 px-3">Folder</th>
                    <th className="py-3 px-3">Attached File</th>
                    <th className="py-3 px-3">Shared With</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items
                    .filter((item) => {
                      if (assetFolder === "All") return true;
                      const meta = parseMeta(item.metadataJson);
                      return (meta.folder || "Sales Collateral") === assetFolder;
                    })
                    .map((item) => {
                      const meta = parseMeta(item.metadataJson);
                      const fileUrl = normalizeFileUrl(meta.fileUrl);
                      const fileName = meta.fileName || item.name;
                      return (
                        <tr key={item.id} className="hover:bg-blue-50/30">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.subtitle}
                            </p>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {meta.folder || "Sales Collateral"}
                          </td>
                          <td className="py-3 px-3">
                            {fileUrl ? (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={fileName}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[180px]">
                                  {fileName}
                                </span>
                                <Download className="w-3.5 h-3.5 ml-1" />
                              </a>
                            ) : (
                              <span className="text-slate-400">No file</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {meta.programVisibility || "All Programs"}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() =>
                                mutate(
                                  "DELETE_MANAGE_ITEM",
                                  { id: item.id },
                                  `Deleted asset "${item.name}"`
                                )
                              }
                              className="inline-flex items-center px-2 py-1 rounded text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. CERTIFICATIONS */}
        {selectedTool === "certifications" && (
          <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4">Certification Name</th>
                  <th className="py-3 px-3">Validity period</th>
                  <th className="py-3 px-3">Passing Score</th>
                  <th className="py-3 px-3">Certified Partners</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((cert) => {
                  const meta = parseMeta(cert.metadataJson);
                  const awarded: string[] = Array.isArray(meta.awardedPartners)
                    ? meta.awardedPartners
                    : [];
                  return (
                    <tr key={cert.id} className="hover:bg-blue-50/30">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{cert.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {cert.subtitle}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-blue-700">
                        {meta.validityMonths || 24} Months
                      </td>
                      <td className="py-3.5 px-3 font-medium">
                        {meta.passingScore || "85%"}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {awarded.length === 0 ? (
                            <span className="text-slate-400">None yet</span>
                          ) : (
                            awarded.map((pName) => (
                              <span
                                key={pName}
                                className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold"
                              >
                                {pName}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={cert.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedPartnerToAward(partners[0]?.name || "");
                            setAwardModalCertId(cert.id);
                          }}
                          className="px-2.5 py-1 rounded border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold"
                        >
                          + Award Partner
                        </button>
                        <button
                          onClick={() => openEditModal(cert)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() =>
                            mutate(
                              "DELETE_MANAGE_ITEM",
                              { id: cert.id },
                              `Deleted certification "${cert.name}"`
                            )
                          }
                          className="text-slate-400 hover:text-red-600 px-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ManageEmailAndHelpPanels
          selectedTool={selectedTool}
          emailConnectorStatus={emailConnectorStatus}
          testEmailRecipient={testEmailRecipient}
          setTestEmailRecipient={setTestEmailRecipient}
          handleSendTestEmail={handleSendTestEmail}
          emailDomain={emailDomain}
          setEmailDomain={setEmailDomain}
          emailPrefix={emailPrefix}
          setEmailPrefix={setEmailPrefix}
          items={items}
          parseMeta={parseMeta}
          normalizeFileUrl={normalizeFileUrl}
          openEditModal={openEditModal}
          sessionEmail={session?.email}
          helpSubTab={helpSubTab}
          setHelpSubTab={setHelpSubTab}
          mutate={mutate}
        />

        {/* 5. GROUPS (live computed figures — §1.4) */}
        {selectedTool === "groups" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3 text-right">Partners</th>
                  <th className="py-2 px-3 text-right">Submitted leads</th>
                  <th className="py-2 px-3 text-right">Converted leads</th>
                  <th className="py-2 px-3 text-right">Registered deals</th>
                  <th className="py-2 px-3 text-right">Won deals</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                {items.map((g) => {
                  const grpPartners = partners.filter(
                    (p) => p.groupName === g.name
                  );
                  const grpPartnerNames = new Set(
                    grpPartners.map((p) => p.name)
                  );
                  const grpLeads = leads.filter((l) =>
                    grpPartnerNames.has(l.sourcePartnerName)
                  );
                  const grpConverted = grpLeads.filter(
                    (l) => l.status === "Converted"
                  );
                  const grpDeals = deals.filter((d) =>
                    grpPartnerNames.has(d.partnerName)
                  );
                  const grpWon = grpDeals.filter(
                    (d) => d.stage === "Closed Won"
                  );
                  return (
                    <tr key={g.id} className="hover:bg-blue-50/40">
                      <td className="py-2.5 px-3 font-bold text-blue-700">
                        {g.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {grpPartners.length}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {grpLeads.length}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {grpConverted.length}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {grpDeals.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {grpWon.length}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => openEditModal(g)}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold"
                        >
                          Edit &amp; Members
                        </button>
                        <button
                          onClick={() =>
                            mutate(
                              "DELETE_MANAGE_ITEM",
                              { id: g.id },
                              `Deleted group "${g.name}"`
                            )
                          }
                          className="text-slate-400 hover:text-red-600 px-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. INTEGRATIONS */}
        {selectedTool === "integrations" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {items.map((intItem) => {
              const isConn = intItem.status === "Connected";
              return (
                <div
                  key={intItem.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                    isConn
                      ? "border-blue-300 bg-blue-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {intItem.name}
                      </h4>
                      <p className="text-slate-600 mt-0.5">
                        {intItem.subtitle}
                      </p>
                    </div>
                    <StatusBadge status={intItem.status} />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openEditModal(intItem)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
                    >
                      Configure Settings
                    </button>
                    <button
                      onClick={() =>
                        mutate(
                          "TOGGLE_MANAGE_ITEM_STATUS",
                          {
                            id: intItem.id,
                            status: isConn ? "Available" : "Connected",
                          },
                          `${intItem.name} ${
                            isConn ? "disconnected" : "connected"
                          }!`
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold ${
                        isConn
                          ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isConn ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REMAINING SUB-MODULES (incl. commission_templates, news, products, team, workflows, pipelines) */}
        {![
          "assets",
          "certifications",
          "email_setup",
          "email_templates",
          "groups",
          "help_articles",
          "integrations",
        ].includes(selectedTool) && (
          <div className="divide-y divide-slate-100 text-xs">
            {items.length === 0 ? (
              <p className="py-6 text-center text-slate-400">
                No {activeMod.title.toLowerCase()} records yet.
              </p>
            ) : (
              items.map((item) => {
                const meta = parseMeta(item.metadataJson);
                return (
                  <div
                    key={item.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-lg"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold text-sm text-slate-900">
                          {item.name}
                        </p>
                        <StatusBadge status={item.status} />
                        {selectedTool === "workflows" &&
                          meta.runs !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
                              Runs: {meta.runs}
                            </span>
                          )}
                      </div>
                      <p className="text-slate-600">{item.subtitle}</p>
                      {meta.fileName && meta.fileUrl && (
                        <a
                          href={normalizeFileUrl(meta.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          download={meta.fileName}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:underline font-semibold pt-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Attachment: {meta.fileName}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {selectedTool === "workflows" && (
                        <button
                          onClick={() =>
                            handleRunWorkflowNow(item.id, item.name)
                          }
                          className="px-2.5 py-1 rounded border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold flex items-center space-x-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Run Now</span>
                        </button>
                      )}
                      {selectedTool === "team" && meta.email && (
                        <button
                          onClick={() =>
                            mutate(
                              "SEND_EMAIL",
                              {
                                to: meta.email,
                                subject: `Reminder: Join {{workspace.name}} (${item.name})`,
                                body: `Hi ${item.name},\n\nYour coworker invitation to {{workspace.name}} is ready.\n\nBest regards,\n{{workspace.name}}`,
                                templateName: "Coworker Invite",
                              },
                              `Resent invitation email to ${item.name}!`
                            )
                          }
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
                        >
                          Resend Invite
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(item)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() =>
                          mutate(
                            "DELETE_MANAGE_ITEM",
                            { id: item.id },
                            `Deleted "${item.name}"`
                          )
                        }
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <ManageModals
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        editingId={editingId}
        setEditingId={setEditingId}
        selectedTool={selectedTool}
        activeModTitle={activeMod.title}
        activeModCta={activeMod.cta}
        form={form}
        setForm={setForm}
        handleSaveItem={handleSaveItem}
        handleFileChange={handleFileChange}
        uploading={uploading}
        programs={programs}
        partners={partners}
        baseCurrency={baseCurrency}
        awardModalCertId={awardModalCertId}
        setAwardModalCertId={setAwardModalCertId}
        selectedPartnerToAward={selectedPartnerToAward}
        setSelectedPartnerToAward={setSelectedPartnerToAward}
        handleAwardCertification={handleAwardCertification}
        notifyModalOpen={notifyModalOpen}
        setNotifyModalOpen={setNotifyModalOpen}
        notifyTargetEmail={notifyTargetEmail}
        setNotifyTargetEmail={setNotifyTargetEmail}
        notifyMessage={notifyMessage}
        setNotifyMessage={setNotifyMessage}
        mutate={mutate}
      />
    </div>
  );
}
