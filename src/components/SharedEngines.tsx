"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { downloadCsv, rowsToCsv } from "@/lib/csvExport";
import {
  Search,
  Filter,
  Download,
  Columns,
  ChevronDown,
  Plus,
  ArrowLeft,
  MessageSquare,
  Calendar,
  Mail,
  CheckSquare,
  Paperclip,
  Send,
  Upload,
  Trash2,
  X,
} from "lucide-react";

export const DEAL_STAGES_10 = [
  "To Work On",
  "Appointment Scheduled",
  "Holding",
  "Discovery Stage",
  "Presentation Stage",
  "Quotation Stage",
  "Negotiation Stage",
  "Closing Stage",
  "Closed Won",
  "Closed Lost",
] as const;

export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let cls = "bg-slate-100 text-slate-700 border-slate-200";
  if (
    [
      "active",
      "accepted",
      "completed",
      "closed won",
      "paying",
      "paid",
      "published",
      "connected",
      "live",
      "ready",
      "delivered (smtp)",
    ].includes(s)
  ) {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (
    [
      "pending",
      "in progress",
      "onboarding",
      "sent",
      "due today",
      "upcoming",
      "draft",
      "new",
      "captured in outbox",
      "in-app sandbox",
    ].includes(s)
  ) {
    cls = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (
    ["overdue", "refused", "closed lost", "canceled", "expired", "paused"].includes(s)
  ) {
    cls = "bg-amber-50 text-amber-800 border-amber-200";
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}
    >
      {status}
    </span>
  );
}

interface EntityListToolbarProps {
  title: string;
  countLabel: string;
  views: string[];
  activeView: string;
  onSelectView: (v: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  dateFilterLabel?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  extraRightControls?: React.ReactNode;
  onExport?: () => void;
  /** Rows currently shown in the list; Export downloads them as CSV. Without rows (or onExport) the Export button is hidden. */
  exportRows?: Array<Record<string, unknown>>;
}

export function EntityListToolbar({
  title,
  countLabel,
  views,
  activeView,
  onSelectView,
  search,
  onSearchChange,
  dateFilterLabel = "Creation date",
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  extraRightControls,
  onExport,
  exportRows,
}: EntityListToolbarProps) {
  const { settings, mutate, showToast } = usePrm();
  const [customViews, setCustomViews] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importObjectType, setImportObjectType] = useState("partners");
  const [importCsvText, setImportCsvText] = useState(
    "name,country,programName,qualifyingLevel,status\n"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importPreview, setImportPreview] = useState<any | null>(null);

  const allViews = [...views, ...customViews];
  const baseCurrency = settings?.account_settings?.mainCurrency || "";
  const customProps = Array.isArray(settings.custom_properties)
    ? settings.custom_properties
    : [];

  const handleAddView = () => {
    const name = `Custom View ${customViews.length + 1}`;
    setCustomViews([...customViews, name]);
    onSelectView(name);
    showToast(`Saved view "${name}" created`);
  };

  const handleRunCsvImport = async (dryRun: boolean) => {
    const res = await mutate("CSV_IMPORT", {
      objectType: importObjectType,
      csvText: importCsvText,
      dryRun,
    });
    if (res) {
      setImportPreview(res);
      if (!dryRun && res.ok) {
        showToast(`Imported ${res.imported} ${importObjectType} row(s) via CSV!`);
        setImportModalOpen(false);
      }
    }
  };

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline space-x-3">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {countLabel}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {extraRightControls}
          <button
            onClick={() => {
              setImportPreview(null);
              setImportModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>
          {(onExport || exportRows) && (
          <button
            onClick={() => {
              if (onExport) {
                onExport();
                return;
              }
              const rows = exportRows || [];
              const stamp = new Date().toISOString().slice(0, 10);
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
              downloadCsv(`${slug}-${stamp}.csv`, rowsToCsv(rows));
              showToast(`Exported ${rows.length} row(s) to CSV`);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold"
            >
              {secondaryActionLabel}
            </button>
          )}
          {primaryActionLabel && onPrimaryAction && (
            <button
              onClick={onPrimaryAction}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{primaryActionLabel}</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {allViews.map((v) => (
            <button
              key={v}
              onClick={() => onSelectView(v)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeView === v
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
          <button
            onClick={handleAddView}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md whitespace-nowrap"
          >
            + Add view
          </button>
          <button
            onClick={() => showToast("Manage views drawer opened")}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-md whitespace-nowrap"
          >
            Manage views
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs w-56 focus:outline-none focus:border-blue-600"
            />
          </div>

          <button
            onClick={() => showToast(`Filtered by ${dateFilterLabel}: All time`)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center space-x-1"
          >
            <span>{dateFilterLabel}: All time</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center space-x-1.5 ${
              showFilters
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Show filters</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setViewMenuOpen(!viewMenuOpen)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center space-x-1"
            >
              <span>View</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {viewMenuOpen && (
              <div className="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                {["Save", "Save as new", "Rename", "Delete"].map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setViewMenuOpen(false);
                      showToast(`View action "${act}" executed for "${activeView}"`);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {act}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => showToast("Column customizer saved")}
            className="text-blue-600 hover:underline font-medium flex items-center space-x-1"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>edit columns</span>
          </button>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">Show: 25 items</span>
        </div>
      </div>

      {showFilters && (
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 bg-blue-50/60 border-t border-blue-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-blue-800">Active Quick Filters &amp; Custom Properties:</span>
          <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-slate-700">
            Owner: Any
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-slate-700">
            Currency: Multi-currency{baseCurrency ? ` (Base ${baseCurrency})` : ""}
          </span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {customProps.map((cp: any) => (
            <span
              key={cp.id || cp.name}
              className="px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-800 font-semibold"
            >
              Custom Property ({cp.object || "Object"}): {cp.label || cp.name} ({cp.type || "Text"})
            </span>
          ))}
          <button
            onClick={() => setShowFilters(false)}
            className="text-blue-600 hover:underline ml-auto"
          >
            Hide filters
          </button>
        </div>
      )}

      {/* G9: CSV IMPORT WITH DRY-RUN PREVIEW & ROW-LEVEL ERRORS MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                CSV Data Import (Dry-Run Preview &amp; Row-Level Validation)
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Object Type
                </label>
                <select
                  value={importObjectType}
                  onChange={(e) => {
                    setImportObjectType(e.target.value);
                    setImportPreview(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="partners">Partners</option>
                  <option value="contacts">Partner Contacts / Team Members</option>
                  <option value="leads">Leads</option>
                  <option value="deals">Deals</option>
                  <option value="customers">Customers</option>
                  <option value="transactions">Transactions</option>
                  <option value="rewards">Rewards</option>
                  <option value="payouts">Payouts</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CSV Payload (First row = column headers)
                </label>
                <textarea
                  rows={4}
                  value={importCsvText}
                  onChange={(e) => setImportCsvText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              {importPreview && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="font-bold text-slate-900">
                    {importPreview.dryRun ? "Dry-Run Preview:" : "Import Summary:"}{" "}
                    {importPreview.validRows} valid / {importPreview.totalRows} total rows
                  </p>
                  {Array.isArray(importPreview.rowErrors) &&
                    importPreview.rowErrors.length > 0 && (
                      <div className="text-red-700 space-y-0.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {importPreview.rowErrors.map((err: any, idx: number) => (
                          <p key={idx}>
                            Row {err.row}: {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRunCsvImport(true)}
                className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 font-semibold"
              >
                Dry-Run Preview
              </button>
              <button
                type="button"
                onClick={() => handleRunCsvImport(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Execute Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotesAndActivitiesTab({
  entityType,
  entityId,
}: {
  entityType: "partner" | "lead" | "deal";
  entityId: string;
}) {
  const { notes, tasks, manageItems, settings, session, mutate, showToast } = usePrm();
  const [noteText, setNoteText] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [subTab, setSubTab] = useState<
    "Notes" | "Meetings" | "Emails" | "Tasks" | "Attachments"
  >("Notes");

  const [uploading, setUploading] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [taskName, setTaskName] = useState("");

  // P6: Custom properties for this entityType
  const customProps = (Array.isArray(settings.custom_properties)
    ? settings.custom_properties
    : []
  ).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cp: any) =>
      !cp.object ||
      String(cp.object).toLowerCase().includes(entityType.toLowerCase())
  );

  const entityNotes = notes.filter(
    (n) => n.entityType === entityType && n.entityId === entityId
  );

  const entityAttachments = manageItems.filter((m) => {
    if (m.category !== "entity_attachment") return false;
    try {
      const meta = JSON.parse(m.metadataJson || "{}");
      return meta.entityType === entityType && meta.entityId === entityId;
    } catch {
      return false;
    }
  });

  const entityMeetings = manageItems.filter((m) => {
    if (m.category !== "entity_meeting") return false;
    try {
      const meta = JSON.parse(m.metadataJson || "{}");
      return meta.entityType === entityType && meta.entityId === entityId;
    } catch {
      return false;
    }
  });

  const sentEmails = manageItems.filter((m) => m.category === "sent_emails");

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await mutate(
      "CREATE_NOTE",
      {
        entityType,
        entityId,
        content: noteText,
        isShared,
      },
      "Note posted to timeline"
    );
    setNoteText("");
  };

  const handleUploadAttachment = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        await mutate(
          "CREATE_MANAGE_ITEM",
          {
            category: "entity_attachment",
            name: json.fileName,
            subtitle: `${json.fileSize} · Uploaded by ${
              session?.name || session?.email || "User"
            }`,
            status: "Active",
            metadata: {
              entityType,
              entityId,
              fileName: json.fileName,
              fileUrl: json.fileUrl,
              fileSize: json.fileSize,
            },
          },
          `Uploaded attachment "${json.fileName}"!`
        );
      } else {
        showToast(json.error || "Upload rejected");
      }
    } catch (err) {
      console.error(err);
      showToast("Attachment upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleLogMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle) return;
    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "entity_meeting",
        name: meetingTitle,
        subtitle: `Scheduled via Google Calendar · ${meetingDate}`,
        status: "Upcoming",
        metadata: { entityType, entityId, meetingDate },
      },
      `Meeting "${meetingTitle}" scheduled!`
    );
    setMeetingTitle("");
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject || !emailTo) return;
    await mutate(
      "SEND_EMAIL",
      {
        to: emailTo,
        subject: emailSubject,
        body: emailBody || `Follow-up regarding ${entityType} ${entityId}.`,
        templateName: "Direct Entity Email",
        portalLink: "/p",
      },
      `Email sent to ${emailTo}!`
    );
    setEmailSubject("");
    setEmailBody("");
  };

  const handleAddQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName) return;
    await mutate(
      "CREATE_TASK",
      {
        name: taskName,
        dueDate: "2026-12-05",
        associationType:
          entityType.charAt(0).toUpperCase() + entityType.slice(1),
        associationName: `${entityType.toUpperCase()} (${entityId})`,
      },
      `Task "${taskName}" added!`
    );
    setTaskName("");
  };

  return (
    <div className="space-y-4">
      {customProps.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <p className="font-bold text-slate-800">
            Custom Properties ({entityType.toUpperCase()})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {customProps.map((cp: any) => (
              <div
                key={cp.id || cp.name}
                className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between"
              >
                <span className="text-slate-600">{cp.label || cp.name}:</span>
                <span className="font-semibold text-slate-900">
                  {cp.defaultValue || "Configured"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {(
          [
            { id: "Notes", icon: MessageSquare },
            { id: "Meetings", icon: Calendar },
            { id: "Emails", icon: Mail },
            { id: "Tasks", icon: CheckSquare },
            { id: "Attachments", icon: Paperclip },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 ${
                subTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.id}</span>
            </button>
          );
        })}
      </div>

      {subTab === "Notes" && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddNote}
            className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
          >
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add note... Use @ to mention coworkers or partner contacts"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>
                  Share note with partner on Partner Portal (SHARED badge)
                </span>
              </label>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>Add note</span>
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {entityNotes.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No notes yet. Add the first note above.
              </p>
            ) : (
              entityNotes.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{n.author}</span>
                    <div className="flex items-center space-x-2">
                      {n.isShared && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          SHARED
                        </span>
                      )}
                      <span className="text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {n.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "Meetings" && (
        <div className="space-y-4 text-xs">
          <form
            onSubmit={handleLogMeeting}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block font-semibold text-slate-700 mb-1">
                Meeting Title
              </label>
              <input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g. Executive Deal Review & Co-Sell Call"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Date &amp; Time
              </label>
              <input
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
            >
              + Schedule Meeting
            </button>
          </form>

          <div className="space-y-2">
            {entityMeetings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No meetings scheduled yet.
              </p>
            ) : (
              entityMeetings.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-slate-500">{m.subtitle}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "Emails" && (
        <div className="space-y-4 text-xs">
          <form
            onSubmit={handleSendEmail}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                required
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="To email..."
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
              <input
                required
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line..."
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <textarea
              rows={2}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Write email message..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>Send Email</span>
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {sentEmails.slice(0, 4).map((em) => (
              <div
                key={em.id}
                className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    Subject: {em.name}
                  </p>
                  <p className="text-slate-500 mt-0.5">{em.subtitle}</p>
                </div>
                <StatusBadge status={em.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "Tasks" && (
        <div className="space-y-3 text-xs">
          <form onSubmit={handleAddQuickTask} className="flex gap-2">
            <input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Add follow-up task..."
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
            >
              + Add Task
            </button>
          </form>
          {tasks.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={t.status === "Completed"}
                  onChange={() =>
                    mutate("TOGGLE_TASK", { id: t.id }, "Task status updated")
                  }
                  className="rounded text-blue-600"
                />
                <div>
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-slate-500">
                    Due {t.dueDate} · Assigned to {t.assignedTo}
                  </p>
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}

      {subTab === "Attachments" && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-blue-800 font-semibold">
              <Upload className="w-4 h-4" />
              <span>
                {uploading
                  ? "Uploading attachment..."
                  : "Upload a file attachment to this record"}
              </span>
            </div>
            <input
              type="file"
              onChange={handleUploadAttachment}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            {entityAttachments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No attachments uploaded yet.
              </p>
            ) : (
              entityAttachments.map((att) => {
                let fileUrl = "";
                try {
                  const rawUrl = JSON.parse(att.metadataJson || "{}").fileUrl;
                  if (rawUrl) {
                    fileUrl = rawUrl.startsWith("/uploads/")
                      ? `/api/files/${rawUrl.replace(/^\/uploads\//, "")}`
                      : rawUrl;
                  }
                } catch {
                  // fallback
                }
                return (
                  <div
                    key={att.id}
                    className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{att.name}</p>
                      <p className="text-slate-500">{att.subtitle}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={att.name}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      )}
                      <button
                        onClick={() =>
                          mutate(
                            "DELETE_MANAGE_ITEM",
                            { id: att.id },
                            `Removed attachment "${att.name}"`
                          )
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BackBreadcrumb({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Back to {label}</span>
    </Link>
  );
}
