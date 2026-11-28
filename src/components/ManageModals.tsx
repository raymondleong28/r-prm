"use client";

import React from "react";
import { Check, ExternalLink, Upload, X } from "lucide-react";
import { usePrm } from "@/context/PrmContext";
import { CustomFieldsPanel, useCustomFieldDefs } from "@/components/CustomFields";

/** Products keep custom values in metadataJson.customFields; they can be filled once the product exists. */
function ProductCustomFields({ editingId }: { editingId: string | null }) {
  const { manageItems } = usePrm();
  const defs = useCustomFieldDefs("Products");
  if (defs.length === 0) return null;
  if (!editingId) {
    return <p className="text-[11px] text-slate-500">Custom fields can be filled in after the product is created.</p>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = (manageItems || []).find((m: any) => m.id === editingId);
  let stored: unknown = {};
  try {
    stored = JSON.parse(item?.metadataJson || "{}").customFields || {};
  } catch {
    stored = {};
  }
  return <CustomFieldsPanel objectType="Products" recordId={editingId} stored={stored} />;
}

export interface ManageFormState {
  name: string;
  subtitle: string;
  status: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  mimeType: string;
  folder: string;
  programVisibility: string;
  validityMonths: string;
  passingScore: string;
  awardedPartners: string[];
  emailSubject: string;
  emailTrigger: string;
  emailBody: string;
  groupPartnerIds: string[];
  collection: string;
  articleBody: string;
  apiKey: string;
  webhookUrl: string;
  syncDirection: string;
  sku: string;
  priceBase: string;
  billingCadence: string;
  coworkerEmail: string;
  coworkerTitle: string;
  coworkerPhone: string;
  coworkerRole: string;
  workflowTrigger: string;
  workflowCondition: string;
  workflowAction: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: "send_email" | "wait_days" | "create_task" | "update_field";
  actionTarget: string;
  pipelineStages: string;
  dashboardWidgets: string[];
}

interface ManageModalsProps {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selectedTool: string;
  activeModTitle: string;
  activeModCta: string;
  form: ManageFormState;
  setForm: React.Dispatch<React.SetStateAction<ManageFormState>>;
  handleSaveItem: (e: React.FormEvent) => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[];
  baseCurrency?: string;
  awardModalCertId: string | null;
  setAwardModalCertId: (id: string | null) => void;
  selectedPartnerToAward: string;
  setSelectedPartnerToAward: (partnerName: string) => void;
  handleAwardCertification: (e: React.FormEvent) => Promise<void>;
  notifyModalOpen: boolean;
  setNotifyModalOpen: (open: boolean) => void;
  notifyTargetEmail: string;
  setNotifyTargetEmail: (email: string) => void;
  notifyMessage: string;
  setNotifyMessage: (msg: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload: Record<string, any>, toastMsg?: string) => Promise<any>;
}

export function ManageModals({
  modalOpen,
  setModalOpen,
  editingId,
  setEditingId,
  selectedTool,
  activeModTitle,
  activeModCta,
  form,
  setForm,
  handleSaveItem,
  handleFileChange,
  uploading,
  programs,
  partners,
  baseCurrency = "",
  awardModalCertId,
  setAwardModalCertId,
  selectedPartnerToAward,
  setSelectedPartnerToAward,
  handleAwardCertification,
  notifyModalOpen,
  setNotifyModalOpen,
  notifyTargetEmail,
  setNotifyTargetEmail,
  notifyMessage,
  setNotifyMessage,
  mutate,
}: ManageModalsProps) {
  return (
    <>
      {/* UNIVERSAL MODULE-SPECIFIC CREATE / EDIT MODAL WITH REAL FILE ATTACHMENT UPLOAD */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveItem}
            className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingId ? `Edit ${activeModTitle} Record` : activeModCta}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Name / Title *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Active</option>
                    <option>Published</option>
                    <option>Draft</option>
                    <option>Connected</option>
                    <option>Paused</option>
                  </select>
                </div>
              </div>

              {/* ASSETS FIELDS */}
              {selectedTool === "assets" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Asset Folder
                    </label>
                    <select
                      value={form.folder}
                      onChange={(e) => setForm({ ...form, folder: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>Sales Collateral</option>
                      <option>Contracts</option>
                      <option>Technical Enablement</option>
                      <option>Brand Guidelines</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Visible to Partner Program
                    </label>
                    <select
                      value={form.programVisibility}
                      onChange={(e) =>
                        setForm({ ...form, programVisibility: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>All Programs</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* CERTIFICATIONS FIELDS */}
              {selectedTool === "certifications" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Validity Period (Months)
                    </label>
                    <input
                      type="number"
                      value={form.validityMonths}
                      onChange={(e) =>
                        setForm({ ...form, validityMonths: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Minimum Passing Score
                    </label>
                    <input
                      value={form.passingScore}
                      onChange={(e) =>
                        setForm({ ...form, passingScore: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* EMAIL TEMPLATES FIELDS */}
              {selectedTool === "email_templates" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Email Subject Line *
                      </label>
                      <input
                        value={form.emailSubject}
                        onChange={(e) =>
                          setForm({ ...form, emailSubject: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Lifecycle Trigger
                      </label>
                      <input
                        value={form.emailTrigger}
                        onChange={(e) =>
                          setForm({ ...form, emailTrigger: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Body (Supports merge tags:{" "}
                      <code>{"{{workspace.name}}"}</code>,{" "}
                      <code>{"{{partner.name}}"}</code>,{" "}
                      <code>{"{{contact.first_name}}"}</code>,{" "}
                      <code>{"{{deal.name}}"}</code>)
                    </label>
                    <textarea
                      rows={5}
                      value={form.emailBody}
                      onChange={(e) =>
                        setForm({ ...form, emailBody: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </>
              )}

              {/* GROUPS MEMBER ASSIGNMENT */}
              {selectedTool === "groups" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Partners to this Group:
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-1.5 bg-slate-50">
                    {partners.map((p) => {
                      const checked = form.groupPartnerIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.groupPartnerIds, p.id]
                                : form.groupPartnerIds.filter((id) => id !== p.id);
                              setForm({ ...form, groupPartnerIds: next });
                            }}
                          />
                          <span className="font-medium text-slate-800">
                            {p.name}
                          </span>
                          <span className="text-slate-400">
                            (Current: {p.groupName})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HELP CENTER FIELDS */}
              {selectedTool === "help_articles" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Help Center Collection
                    </label>
                    <select
                      value={form.collection}
                      onChange={(e) =>
                        setForm({ ...form, collection: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>Getting Started for Partners</option>
                      <option>Deal Registration &amp; Protection</option>
                      <option>Commissions, Payouts &amp; Billing</option>
                      <option>Account Mapping &amp; Co-Selling</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Article Body Content
                    </label>
                    <textarea
                      rows={4}
                      value={form.articleBody}
                      onChange={(e) =>
                        setForm({ ...form, articleBody: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              {/* INTEGRATIONS CONFIG FIELDS */}
              {selectedTool === "integrations" && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      API Key / OAuth Client Token
                    </label>
                    <input
                      value={form.apiKey}
                      onChange={(e) =>
                        setForm({ ...form, apiKey: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Webhook Endpoint URL
                    </label>
                    <input
                      value={form.webhookUrl}
                      onChange={(e) =>
                        setForm({ ...form, webhookUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {/* PRODUCTS FIELDS */}
              {selectedTool === "products" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Product SKU
                    </label>
                    <input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Unit Price{baseCurrency ? ` (${baseCurrency})` : ""}
                    </label>
                    <input
                      type="number"
                      value={form.priceBase}
                      onChange={(e) =>
                        setForm({ ...form, priceBase: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Billing Cadence
                    </label>
                    <select
                      value={form.billingCadence}
                      onChange={(e) =>
                        setForm({ ...form, billingCadence: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>Annual License</option>
                      <option>Monthly Subscription</option>
                      <option>One-Time Implementation</option>
                    </select>
                  </div>
                </div>
              )}
              {selectedTool === "products" && (
                <ProductCustomFields editingId={editingId} />
              )}

              {/* TEAM (COWORKERS) FIELDS */}
              {selectedTool === "team" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email *
                    </label>
                    <input
                      required
                      type="email"
                      value={form.coworkerEmail}
                      onChange={(e) =>
                        setForm({ ...form, coworkerEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Job Title
                    </label>
                    <input
                      value={form.coworkerTitle}
                      onChange={(e) =>
                        setForm({ ...form, coworkerTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      value={form.coworkerPhone}
                      onChange={(e) =>
                        setForm({ ...form, coworkerPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      value={form.coworkerRole}
                      onChange={(e) =>
                        setForm({ ...form, coworkerRole: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>Administrator</option>
                      <option>Manager</option>
                      <option>Read-Only</option>
                    </select>
                  </div>
                </div>
              )}

              {/* WORKFLOWS FIELDS (P3 Structured Conditions & Actions) */}
              {selectedTool === "workflows" && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      WHEN Trigger Event
                    </label>
                    <select
                      value={form.workflowTrigger}
                      onChange={(e) =>
                        setForm({ ...form, workflowTrigger: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option>Deal Stage moves to Closed Won</option>
                      <option>New Partner Application Submitted</option>
                      <option>New Deal Registered by Partner</option>
                      <option>Partner Invitation Status Changed</option>
                      <option>Partner Properties Changed</option>
                      <option>Payout Validated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      IF Structured Condition (Field · Operator · Value)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={form.conditionField}
                        onChange={(e) =>
                          setForm({ ...form, conditionField: e.target.value })
                        }
                        className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="status">status</option>
                        <option value="stage">stage</option>
                        <option value="amountBase">amountBase</option>
                        <option value="qualifyingLevel">qualifyingLevel</option>
                        <option value="programName">programName</option>
                      </select>
                      <select
                        value={form.conditionOperator}
                        onChange={(e) =>
                          setForm({ ...form, conditionOperator: e.target.value })
                        }
                        className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="equals">equals (==)</option>
                        <option value="contains">contains</option>
                        <option value="gte">&gt;=</option>
                        <option value="lte">&lt;=</option>
                      </select>
                      <input
                        value={form.conditionValue}
                        onChange={(e) =>
                          setForm({ ...form, conditionValue: e.target.value })
                        }
                        placeholder="Value (e.g. Active)"
                        className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      THEN Structured Action
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={form.actionType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            actionType: e.target.value as ManageFormState["actionType"],
                          })
                        }
                        className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="send_email">Send Email</option>
                        <option value="create_task">Create Task</option>
                        <option value="wait_days">Wait N Days</option>
                        <option value="update_field">Update Field</option>
                      </select>
                      <input
                        value={form.actionTarget}
                        onChange={(e) =>
                          setForm({ ...form, actionTarget: e.target.value })
                        }
                        placeholder="Target (recipient / task title / days)"
                        className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ONBOARDING PIPELINE STAGES */}
              {selectedTool === "onboarding_pipelines" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Onboarding Stages (Comma-separated Kanban columns)
                  </label>
                  <input
                    value={form.pipelineStages}
                    onChange={(e) =>
                      setForm({ ...form, pipelineStages: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* REAL FILE ATTACHMENT UPLOAD */}
              {[
                "assets",
                "certifications",
                "help_articles",
                "news",
                "products",
                "onboarding_pipelines",
              ].includes(selectedTool) && (
                <div className="p-3.5 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-800 flex items-center space-x-1.5">
                      <Upload className="w-4 h-4" />
                      <span>
                        Attach File (PDF, DOCX, Image, CSV, TXT — max 15 MB)
                      </span>
                    </span>
                    {uploading && (
                      <span className="text-blue-600 font-semibold">
                        Uploading...
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {form.fileName && (
                    <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                      <span className="font-semibold text-slate-800 truncate">
                        Attached: {form.fileName} ({form.fileSize || "Ready"})
                      </span>
                      <a
                        href={form.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
                      >
                        <span>Preview</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Summary / Notes
                </label>
                <textarea
                  rows={2}
                  value={form.subtitle}
                  onChange={(e) =>
                    setForm({ ...form, subtitle: e.target.value })
                  }
                  placeholder="Optional custom subtitle or notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingId ? "Save Changes" : "Create"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AWARD CERTIFICATION TO PARTNER MODAL */}
      {awardModalCertId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleAwardCertification}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Award Certification to Partner
              </h3>
              <button
                type="button"
                onClick={() => setAwardModalCertId(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block font-semibold text-slate-700">
                Select Partner Organization
              </label>
              <select
                value={selectedPartnerToAward}
                onChange={(e) => setSelectedPartnerToAward(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.qualifyingLevel})
                  </option>
                ))}
              </select>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setAwardModalCertId(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Issue Certificate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NOTIFY PARTNERS ABOUT ASSET CHANGES MODAL */}
      {notifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate(
                "SEND_EMAIL",
                {
                  to: notifyTargetEmail,
                  subject:
                    "New Enablement Assets Available in R-PRM Partner Portal",
                  body: notifyMessage,
                  templateName: "Asset Update Notification",
                  portalLink: "/p",
                },
                `Asset update email sent to ${notifyTargetEmail}!`
              );
              setNotifyModalOpen(false);
            }}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Notify partners about asset changes
              </h3>
              <button
                type="button"
                onClick={() => setNotifyModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Partner Email
                </label>
                <input
                  required
                  value={notifyTargetEmail}
                  onChange={(e) => setNotifyTargetEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notification Message
                </label>
                <textarea
                  rows={3}
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setNotifyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Send Notification
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
