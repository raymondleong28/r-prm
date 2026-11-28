"use client";

import React, { useEffect, useState } from "react";
import { AccountMfaSection } from "@/components/AccountMfaSection";
import { PartnerPipelineSettings } from "@/components/PartnerPipelineSettings";
import {
  readProspectionSettings,
  type ProspectionCardFieldId,
} from "@/lib/prospectionSettings";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge, DEAL_STAGES_10 } from "@/components/SharedEngines";
import { AccountSystemTabs } from "@/components/AccountSystemTabs";
import { CURRENCY_LABELS, SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { Shield } from "lucide-react";

const ACCOUNT_CATEGORIES = [
  { id: "defaults", label: "Account defaults" },
  { id: "partner-portal", label: "Partner portal" },
  { id: "directories", label: "Directories" },
  { id: "security", label: "Security" },
  { id: "partners", label: "Partner settings" },
  { id: "leads", label: "Lead settings" },
  { id: "deals", label: "Deal settings" },
  { id: "payouts", label: "Payout settings" },
  { id: "properties", label: "Properties" },
  { id: "data", label: "Account data" },
  { id: "integration", label: "Integration" },
  { id: "audit-log", label: "Audit trail" },
] as const;

const PROPERTY_OBJECTS = [
  "Contacts",
  "Customers",
  "Deals",
  "Leads",
  "Partners",
  "Rewards",
  "Payouts",
  "Tasks",
  "Transactions",
  "Products",
];

export default function AccountRootPage() {
  const params = useParams();
  const initialTab = String(params?.tab || "defaults");
  const { settings, manageItems, session, auditLogs, partners, mutate, refresh, showToast } =
    usePrm();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [propObject, setPropObject] = useState("Leads");
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("Single line text");
  const [resetConfirmationText, setResetConfirmationText] = useState("");

  const acct = settings.account_settings || {};
  // Partner types: saved list, or (before the first save) the types already used on partner records
  const [partnerTypes, setPartnerTypes] = useState<string[]>(() =>
    Array.isArray(acct.partnerTypes)
      ? acct.partnerTypes
      : Array.from(
          new Set(
            (partners || [])
              .map((p: { partnerType?: string | null }) => String(p.partnerType || "").trim())
              .filter(Boolean)
          )
        )
  );
  const [prospectionStages, setProspectionStages] = useState<string[]>(
    () => readProspectionSettings(acct).stages
  );
  const [prospectionCardFields, setProspectionCardFields] = useState<ProspectionCardFieldId[]>(
    () => readProspectionSettings(acct).cardFields
  );
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];

  const [accountName, setAccountName] = useState(acct.accountName || "");
  const [timezone, setTimezone] = useState(acct.timezone || "UTC");
  const [mainCurrency, setMainCurrency] = useState(baseCurrency);
  const [defaultOwnerName, setDefaultOwnerName] = useState(
    acct.defaultOwnerName || ""
  );
  const [logoText, setLogoText] = useState(
    acct.logoText || (acct.accountName ? String(acct.accountName).charAt(0).toUpperCase() : "R")
  );
  const [primaryColor, setPrimaryColor] = useState(
    acct.primaryColor || "#2563EB"
  );
  const [portalDomain, setPortalDomain] = useState(acct.portalDomain || "");
  const [directorySubdomain, setDirectorySubdomain] = useState(
    acct.directorySubdomain || ""
  );
  const [requireMfaCoworkers, setRequireMfaCoworkers] = useState(
    Boolean(acct.requireMfaCoworkers)
  );
  const [requireMfaPartners, setRequireMfaPartners] = useState(
    Boolean(acct.requireMfaPartners)
  );
  const [leadConsentText, setLeadConsentText] = useState(
    acct.leadConsentText ||
      "I confirm I have obtained permission from this prospect to share their business contact details with {{workspace.name}}."
  );
  const [leadConsentTermsLabel, setLeadConsentTermsLabel] = useState(
    acct.leadConsentTermsLabel || "Terms & Privacy Policy"
  );
  const [leadConsentTermsUrl, setLeadConsentTermsUrl] = useState(
    acct.leadConsentTermsUrl || ""
  );
  const [dealConflictDetection, setDealConflictDetection] = useState(
    acct.dealConflictDetection ||
      "Warn & flag duplicate Deals across Customer company or contact email domain"
  );
  const [dealExpirationDays, setDealExpirationDays] = useState(
    Number(acct.dealExpirationDays ?? 90)
  );
  const [dealReminderDays, setDealReminderDays] = useState(
    Number(acct.dealReminderDays ?? 14)
  );
  const [allowDealResubmission, setAllowDealResubmission] = useState(
    Boolean(acct.allowDealResubmission ?? true)
  );
  const [autoAssociateCustomers, setAutoAssociateCustomers] = useState(
    Boolean(acct.autoAssociateCustomers ?? true)
  );
  const [dealValidationStrategy, setDealValidationStrategy] = useState(
    acct.dealValidationStrategy ||
      acct.validationStrategy ||
      "Anyone (Partner Owner or Administrator)"
  );
  const [acknowledgeDealTemplate, setAcknowledgeDealTemplate] = useState(
    acct.acknowledgeDealTemplate || ""
  );
  const [autoPayoutSchedule, setAutoPayoutSchedule] = useState(
    acct.autoPayoutSchedule || "Every month on the 1st day"
  );
  const [autoPayoutThresholdBase, setAutoPayoutThresholdBase] = useState(
    Number(acct.autoPayoutThresholdBase ?? 250)
  );
  const [selfInvoicingEnabled, setSelfInvoicingEnabled] = useState(
    Boolean(acct.selfInvoicingEnabled ?? true)
  );
  const [legalEntityName, setLegalEntityName] = useState(
    acct.legalEntityName || ""
  );
  const [taxId, setTaxId] = useState(acct.taxId || "");
  const [billingAddress, setBillingAddress] = useState(
    acct.billingAddress || ""
  );

  useEffect(() => {
    if (Array.isArray(settings.account_settings?.partnerTypes)) return;
    setPartnerTypes(
      Array.from(
        new Set(
          (partners || [])
            .map((p: { partnerType?: string | null }) => String(p.partnerType || "").trim())
            .filter(Boolean)
        )
      )
    );
  }, [partners, settings.account_settings]);

  useEffect(() => {
    const s = settings.account_settings;
    if (!s) return;
    if (s.accountName !== undefined) setAccountName(s.accountName);
    if (Array.isArray(s.partnerTypes)) setPartnerTypes(s.partnerTypes);
    const prospection = readProspectionSettings(s);
    setProspectionStages(prospection.stages);
    setProspectionCardFields(prospection.cardFields);
    if (s.timezone !== undefined) setTimezone(s.timezone);
    if (s.mainCurrency !== undefined) setMainCurrency(s.mainCurrency);
    if (s.defaultOwnerName !== undefined)
      setDefaultOwnerName(s.defaultOwnerName);
    if (s.logoText !== undefined) setLogoText(s.logoText);
    if (s.primaryColor !== undefined) setPrimaryColor(s.primaryColor);
    if (s.portalDomain !== undefined) setPortalDomain(s.portalDomain);
    if (s.directorySubdomain !== undefined)
      setDirectorySubdomain(s.directorySubdomain);
    if (s.requireMfaCoworkers !== undefined)
      setRequireMfaCoworkers(Boolean(s.requireMfaCoworkers));
    if (s.requireMfaPartners !== undefined)
      setRequireMfaPartners(Boolean(s.requireMfaPartners));
    if (s.leadConsentText !== undefined) setLeadConsentText(s.leadConsentText);
    if (s.leadConsentTermsLabel !== undefined)
      setLeadConsentTermsLabel(s.leadConsentTermsLabel);
    if (s.leadConsentTermsUrl !== undefined)
      setLeadConsentTermsUrl(s.leadConsentTermsUrl);
    if (s.dealConflictDetection)
      setDealConflictDetection(s.dealConflictDetection);
    if (s.dealExpirationDays !== undefined)
      setDealExpirationDays(Number(s.dealExpirationDays));
    if (s.dealReminderDays !== undefined)
      setDealReminderDays(Number(s.dealReminderDays));
    if (s.allowDealResubmission !== undefined)
      setAllowDealResubmission(Boolean(s.allowDealResubmission));
    if (s.autoAssociateCustomers !== undefined)
      setAutoAssociateCustomers(Boolean(s.autoAssociateCustomers));
    if (s.dealValidationStrategy || s.validationStrategy)
      setDealValidationStrategy(
        s.dealValidationStrategy || s.validationStrategy
      );
    if (s.acknowledgeDealTemplate !== undefined)
      setAcknowledgeDealTemplate(s.acknowledgeDealTemplate);
    if (s.autoPayoutSchedule) setAutoPayoutSchedule(s.autoPayoutSchedule);
    if (s.autoPayoutThresholdBase !== undefined)
      setAutoPayoutThresholdBase(Number(s.autoPayoutThresholdBase));
    if (s.selfInvoicingEnabled !== undefined)
      setSelfInvoicingEnabled(Boolean(s.selfInvoicingEnabled));
    if (s.legalEntityName !== undefined) setLegalEntityName(s.legalEntityName);
    if (s.taxId !== undefined) setTaxId(s.taxId);
    if (s.billingAddress !== undefined) setBillingAddress(s.billingAddress);
  }, [settings.account_settings]);

  const customProps = manageItems.filter(
    (m) => m.category === "custom_properties"
  );
  const emailTemplates = manageItems.filter(
    (m) => m.category === "email_templates"
  );

  const handleSaveSettings = async (msg = "Settings saved to database!") => {
    await mutate(
      "SAVE_SETTING",
      {
        key: "account_settings",
        value: {
          ...acct,
          accountName,
          timezone,
          mainCurrency,
          defaultOwnerName,
          logoText,
          primaryColor,
          portalDomain,
          directorySubdomain,
          requireMfaCoworkers,
          requireMfaPartners,
          leadConsentText,
          leadConsentTermsLabel,
          leadConsentTermsUrl,
          dealConflictDetection,
          dealExpirationDays,
          dealReminderDays,
          allowDealResubmission,
          autoAssociateCustomers,
          dealValidationStrategy,
          acknowledgeDealTemplate,
          autoPayoutSchedule,
          autoPayoutThresholdBase,
          selfInvoicingEnabled,
          legalEntityName,
          taxId,
          billingAddress,
          partnerTypes,
          prospectionStages,
          prospectionCardFields,
        },
      },
      msg
    );
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName) return;
    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "custom_properties",
        name: newPropName,
        subtitle: `Object: ${propObject} · Type: ${newPropType} · Active in Forms, Detail Views & Columns`,
        status: "Active",
        metadata: { objectType: propObject, fieldType: newPropType },
      },
      `Custom property "${newPropName}" added to ${propObject}!`
    );
    setNewPropName("");
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : portalDomain || "";

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-xs text-slate-500">
          Workspace configuration tabs across Partner, Lead, Deal, Payout,
          Security, Custom Properties, and Audit Trail
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm space-y-1 h-fit">
          {ACCOUNT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === cat.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-xs space-y-5">
          {/* 1. ACCOUNT DEFAULTS */}
          {activeTab === "defaults" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Account defaults
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account name
                  </label>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Acme Ltd"
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
                    placeholder="UTC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Main currency (Base reporting currency)
                  </label>
                  <select
                    value={mainCurrency}
                    onChange={(e) => setMainCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_LABELS[code] || code} ({code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Default workspace owner (for unassigned records/tasks)
                  </label>
                  <input
                    value={defaultOwnerName}
                    onChange={(e) => setDefaultOwnerName(e.target.value)}
                    placeholder="Leave empty to flag unassigned tasks"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Legal entity name (for invoices)
                  </label>
                  <input
                    value={legalEntityName}
                    onChange={(e) => setLegalEntityName(e.target.value)}
                    placeholder="Acme Enterprise Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Billing address (for invoices)
                  </label>
                  <input
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Street, City, Postal Code"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <label className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded text-blue-600"
                />
                <span className="font-medium text-slate-800">
                  Track leads and deals in multiple currencies with dated FX
                  rates (Base: {mainCurrency})
                </span>
              </label>
              <button
                onClick={() => handleSaveSettings("Account defaults saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Account Defaults
              </button>
            </div>
          )}

          {/* 2. PARTNER PORTAL */}
          {activeTab === "partner-portal" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Partner portal branding &amp; custom domain
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900">
                    Emblem monogram &amp; Portal title
                  </p>
                  <div className="flex items-center space-x-3">
                    <div
                      style={{ backgroundColor: primaryColor }}
                      className="w-12 h-12 rounded-xl text-white font-extrabold text-2xl flex items-center justify-center"
                    >
                      {logoText}
                    </div>
                    <input
                      maxLength={2}
                      value={logoText}
                      onChange={(e) =>
                        setLogoText(e.target.value.toUpperCase())
                      }
                      className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-center"
                    />
                  </div>
                  <p className="text-slate-500">
                    Active emblem on <code>/p</code> Partner Portal for{" "}
                    {accountName || "this workspace"}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900">
                    Primary colour &amp; Portal domain
                  </p>
                  <div className="flex items-center space-x-2">
                    <div
                      style={{ backgroundColor: primaryColor }}
                      className="w-8 h-8 rounded border border-slate-300"
                    />
                    <input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <input
                    value={portalDomain}
                    onChange={(e) => setPortalDomain(e.target.value)}
                    placeholder="https://partners.example.com"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveSettings("Partner portal branding saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Portal Branding
              </button>
            </div>
          )}

          {/* 3. DIRECTORIES */}
          {activeTab === "directories" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Partner Directories
              </h2>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Partner directory slug
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    value={directorySubdomain}
                    onChange={(e) => setDirectorySubdomain(e.target.value)}
                    placeholder="partner-directory"
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={() => handleSaveSettings("Directory slug saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Directory Settings
              </button>
            </div>
          )}

          {/* 4. SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Security — Authentication, TOTP MFA &amp; Single Sign-On
                  </h2>
                </div>
                <div className="flex space-x-2">
                  <Link
                    href="/login"
                    className="px-3 py-1 rounded border border-blue-600 text-blue-700 font-semibold"
                  >
                    Coworker Login (/login)
                  </Link>
                  <Link
                    href="/p/login"
                    className="px-3 py-1 rounded bg-blue-600 text-white font-semibold"
                  >
                    Partner Login (/p/login)
                  </Link>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold">
                    Require Authenticator-App MFA (TOTP) for my coworkers
                  </span>
                  <input
                    type="checkbox"
                    checked={requireMfaCoworkers}
                    onChange={(e) => setRequireMfaCoworkers(e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold">
                    Require Authenticator-App MFA (TOTP) for partner users
                  </span>
                  <input
                    type="checkbox"
                    checked={requireMfaPartners}
                    onChange={(e) => setRequireMfaPartners(e.target.checked)}
                  />
                </label>
              </div>

              {/* The signed-in user's own two-step login */}
              <AccountMfaSection
                email={session?.email || ""}
                enrolled={Boolean(session?.mfaEnrolled)}
                requiredForMe={
                  session?.identityType === "partner" ? requireMfaPartners : requireMfaCoworkers
                }
                onChanged={refresh}
                onToast={showToast}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SP Entity ID
                  </label>
                  <input
                    readOnly
                    value={currentOrigin ? `${currentOrigin}/saml/metadata` : "/saml/metadata"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SP Callback URL (ACS)
                  </label>
                  <input
                    readOnly
                    value={currentOrigin ? `${currentOrigin}/saml/acs` : "/saml/acs"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveSettings("Security & MFA policy saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Security Policy
              </button>
            </div>
          )}

          {/* 5. PARTNER SETTINGS */}
          {activeTab === "partners" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Partner settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Configure Partner properties →
                </button>
              </div>

              <PartnerPipelineSettings
                partnerTypes={partnerTypes}
                setPartnerTypes={setPartnerTypes}
                stages={prospectionStages}
                setStages={setProspectionStages}
                cardFields={prospectionCardFields}
                setCardFields={setProspectionCardFields}
                stageCounts={(partners || []).reduce(
                  (acc: Record<string, number>, p: { prospectionStage?: string | null }) => {
                    const k = String(p.prospectionStage || "");
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  },
                  {}
                )}
              />

              <button
                onClick={() => handleSaveSettings("Partner settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Partner Settings
              </button>
            </div>
          )}

          {/* 6. LEAD SETTINGS (including Lead-Form Consent Wording & Terms Link — §3.5.2) */}
          {activeTab === "leads" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Lead settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Configure Lead properties →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    Channel conflict detection (Duplicate Lead Check)
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option>
                      Check duplicates across Leads, Deals, and Customers (Warn
                      &amp; Flag)
                    </option>
                    <option>
                      Block partners from submitting duplicate email domains
                    </option>
                    <option>Allow duplicate submissions (No check)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    Lead validation strategy
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option>Anyone (Partner Owner or Administrator)</option>
                    <option>Dedicated Partner Owner only</option>
                    <option>Workspace Administrators only</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3 md:col-span-2">
                  <h3 className="font-bold text-slate-900">
                    Public Partner Lead Form — Required Prospect Consent Wording
                  </h3>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Consent checkbox text (supports{" "}
                      <code>{"{{workspace.name}}"}</code>)
                    </label>
                    <textarea
                      rows={2}
                      value={leadConsentText}
                      onChange={(e) => setLeadConsentText(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Terms / privacy link label
                      </label>
                      <input
                        value={leadConsentTermsLabel}
                        onChange={(e) =>
                          setLeadConsentTermsLabel(e.target.value)
                        }
                        placeholder="Terms & Privacy Policy"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Terms / privacy URL (optional)
                      </label>
                      <input
                        value={leadConsentTermsUrl}
                        onChange={(e) => setLeadConsentTermsUrl(e.target.value)}
                        placeholder="https://example.com/privacy"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Lead settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Lead Settings
              </button>
            </div>
          )}

          {/* 7. DEAL SETTINGS */}
          {activeTab === "deals" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Deal settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  1. Deal properties (Configure Deal properties) →
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  2. Deal stages (10 Pipeline Stages including Holding)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {DEAL_STAGES_10.map((stg, idx) => (
                    <span
                      key={stg}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                    >
                      {idx + 1}. {stg}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">
                    3. Deal cards (Kanban Card Layout)
                  </h4>
                  <p className="text-slate-600">
                    Visible card properties: Deal Name, Partner Name, Amount
                    &amp; Currency, Probability (%), Expected Close Date, Owner,
                    Conflict Flag.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    4. Channel-conflict detection (Duplicate Deal Check)
                  </label>
                  <select
                    value={dealConflictDetection}
                    onChange={(e) => setDealConflictDetection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Warn & flag duplicate Deals across Customer company or contact email domain">
                      Warn &amp; flag duplicate Deals across Customer company or
                      contact email domain
                    </option>
                    <option value="Block partners from registering a Deal when an active protected Deal exists">
                      Block partners from registering a Deal when an active
                      protected Deal exists
                    </option>
                    <option value="Allow duplicate deal registrations (No conflict check)">
                      Allow duplicate deal registrations (No conflict check)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    5. Deal expiration protection window (days) &amp; reminder
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Protection days
                      </span>
                      <input
                        type="number"
                        value={dealExpirationDays}
                        onChange={(e) =>
                          setDealExpirationDays(Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Reminder days before
                      </span>
                      <input
                        type="number"
                        value={dealReminderDays}
                        onChange={(e) =>
                          setDealReminderDays(Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    6. Deal resubmission &amp; 7. Associate customers
                    automatically
                  </label>
                  <label className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      checked={allowDealResubmission}
                      onChange={(e) =>
                        setAllowDealResubmission(e.target.checked)
                      }
                    />
                    <span className="font-medium text-slate-800">
                      Allow partners to resubmit expired or refused deals
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoAssociateCustomers}
                      onChange={(e) =>
                        setAutoAssociateCustomers(e.target.checked)
                      }
                    />
                    <span className="font-medium text-slate-800">
                      Link or create Customer when Deal closes won
                    </span>
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900 mb-1">
                    8. Validation strategy
                  </label>
                  <select
                    value={dealValidationStrategy}
                    onChange={(e) => setDealValidationStrategy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Anyone (Partner Owner or Administrator)">
                      Anyone (Partner Owner or Administrator)
                    </option>
                    <option value="Dedicated Partner Owner only">
                      Dedicated Partner Owner only
                    </option>
                    <option value="Workspace Administrators only">
                      Workspace Administrators only
                    </option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900 mb-1">
                    9. Acknowledge deal registrations (Email Template)
                  </label>
                  <select
                    value={acknowledgeDealTemplate}
                    onChange={(e) => setAcknowledgeDealTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">None selected</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.name}>
                        Template: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Deal settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Deal Settings
              </button>
            </div>
          )}

          {/* 8. PAYOUT SETTINGS (§3.5.2 Self-Invoicing Entity & Address from Settings) */}
          {activeTab === "payouts" && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Payout settings &amp; Self-Invoicing
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center justify-between font-bold text-slate-900">
                    <span>Automatic payout creation</span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="block text-slate-600">
                    Schedule:
                    <select
                      value={autoPayoutSchedule}
                      onChange={(e) => setAutoPayoutSchedule(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Every month on the 1st day">
                        Every month on the 1st day
                      </option>
                      <option value="Every quarter on the 1st day">
                        Every quarter on the 1st day
                      </option>
                    </select>
                  </label>
                  <label className="block text-slate-600">
                    Minimum payout threshold ({mainCurrency}):
                    <input
                      type="number"
                      value={autoPayoutThresholdBase}
                      onChange={(e) =>
                        setAutoPayoutThresholdBase(Number(e.target.value) || 0)
                      }
                      className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900">
                    Payout settlement methods
                  </h3>
                  {["Manual", "Bank Transfer"].map((prov) => (
                    <label
                      key={prov}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-800">{prov}</span>
                      <input type="checkbox" defaultChecked />
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <label className="flex items-center justify-between font-bold text-slate-900">
                  <span>
                    Enable Self-Invoicing (Generate partner invoices using your
                    legal entity details below)
                  </span>
                  <input
                    type="checkbox"
                    checked={selfInvoicingEnabled}
                    onChange={(e) => setSelfInvoicingEnabled(e.target.checked)}
                  />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={legalEntityName}
                    onChange={(e) => setLegalEntityName(e.target.value)}
                    placeholder="Legal Company Name (e.g. Acme Ltd)"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Tax / Registration ID"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Billing Address"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Payout settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Payout Settings
              </button>
            </div>
          )}

          <AccountSystemTabs
            activeTab={activeTab}
            propertyObjects={PROPERTY_OBJECTS}
            propObject={propObject}
            setPropObject={setPropObject}
            newPropName={newPropName}
            setNewPropName={setNewPropName}
            newPropType={newPropType}
            setNewPropType={setNewPropType}
            handleAddProperty={handleAddProperty}
            customProps={customProps}
            resetConfirmationText={resetConfirmationText}
            setResetConfirmationText={setResetConfirmationText}
            showToast={showToast}
            currentOrigin={currentOrigin}
            mutate={mutate}
            auditLogs={auditLogs}
          />
        </div>
      </div>
    </div>
  );
}
