"use client";

import React from "react";
import { StatusBadge } from "@/components/SharedEngines";
import { Send, Edit3, Trash2, Download } from "lucide-react";

interface ManageEmailAndHelpPanelsProps {
  selectedTool: string;
  emailConnectorStatus: {
    driver?: string;
    smtpConfigured?: boolean;
    smtpHost?: string;
    smtpPort?: number;
  };
  testEmailRecipient: string;
  setTestEmailRecipient: (v: string) => void;
  handleSendTestEmail: () => void;
  emailDomain: string;
  setEmailDomain: (v: string) => void;
  emailPrefix: string;
  setEmailPrefix: (v: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseMeta: (raw?: string) => Record<string, any>;
  normalizeFileUrl: (url?: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openEditModal: (item: any) => void;
  sessionEmail?: string;
  helpSubTab: "Articles" | "Collections";
  setHelpSubTab: (tab: "Articles" | "Collections") => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload?: any, successMessage?: string) => Promise<any>;
}

export function ManageEmailAndHelpPanels({
  selectedTool,
  emailConnectorStatus,
  testEmailRecipient,
  setTestEmailRecipient,
  handleSendTestEmail,
  emailDomain,
  setEmailDomain,
  emailPrefix,
  setEmailPrefix,
  items,
  parseMeta,
  normalizeFileUrl,
  openEditModal,
  sessionEmail,
  helpSubTab,
  setHelpSubTab,
  mutate,
}: ManageEmailAndHelpPanelsProps) {
  return (
    <>
      {selectedTool === "email_setup" && (
        <div className="space-y-6 text-xs">
          <div className="p-5 rounded-xl border-2 border-blue-200 bg-blue-50/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-blue-900">
                  Outbound Email Connector Status (Server Environment)
                </h3>
                <p className="text-slate-600">
                  SMTP credentials come exclusively from environment variables (
                  <code>EMAIL_DRIVER</code>, <code>SMTP_HOST</code>,{" "}
                  <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{" "}
                  <code>SMTP_PASS</code>).
                </p>
              </div>
              <StatusBadge
                status={
                  emailConnectorStatus.driver === "smtp" &&
                  emailConnectorStatus.smtpConfigured
                    ? "Active"
                    : "Pending"
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3.5 rounded-lg border border-blue-100">
              <div>
                <span className="text-slate-500 block">EMAIL_DRIVER</span>
                <span className="font-bold text-slate-900 font-mono">
                  {emailConnectorStatus.driver || "local"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">SMTP Server</span>
                <span className="font-bold text-slate-900 font-mono">
                  {emailConnectorStatus.smtpConfigured
                    ? `${emailConnectorStatus.smtpHost}:${emailConnectorStatus.smtpPort}`
                    : "Local Outbox"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Credentials Storage
                </span>
                <span className="font-semibold text-emerald-700">
                  Environment-only (Redacted from API)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-blue-200">
              <span className="text-[11px] text-slate-600">
                Test outbound email delivery:
              </span>
              <div className="flex items-center space-x-2">
                <input
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  placeholder="recipient@acme.com"
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white w-56"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">
              Custom Sending Domain
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custom sending domain
                </label>
                <input
                  value={emailDomain}
                  onChange={(e) => setEmailDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Send Emails from prefix
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <span className="text-slate-500 font-medium">
                    {emailDomain}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTool === "email_templates" && (
        <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-3">Trigger / Description</th>
                <th className="py-3 px-3">Subject</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((tpl) => {
                const meta = parseMeta(tpl.metadataJson);
                const subject =
                  meta.emailSubject ||
                  tpl.subtitle?.replace(/^Subject:\s*/i, "") ||
                  tpl.name;
                return (
                  <tr key={tpl.id} className="hover:bg-blue-50/30">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {tpl.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {meta.trigger || "Automated lifecycle email"}
                    </td>
                    <td className="py-3 px-3 font-medium text-blue-700">
                      {subject}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={tpl.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() =>
                          mutate(
                            "SEND_EMAIL",
                            {
                              to: sessionEmail || "",
                              subject,
                              body:
                                meta.emailBody ||
                                `Test delivery of template "${tpl.name}" from {{workspace.name}}.`,
                              templateName: tpl.name,
                              portalLink: "/p",
                            },
                            `Sent test email "${tpl.name}"!`
                          )
                        }
                        className="px-2.5 py-1 rounded border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold inline-flex items-center space-x-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Test</span>
                      </button>
                      <button
                        onClick={() => openEditModal(tpl)}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Template</span>
                      </button>
                      <button
                        onClick={() =>
                          mutate(
                            "DELETE_MANAGE_ITEM",
                            { id: tpl.id },
                            `Deleted email template "${tpl.name}"`
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

      {selectedTool === "help_articles" && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            {(["Articles", "Collections"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setHelpSubTab(st)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold ${
                  helpSubTab === st
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {helpSubTab === "Articles" ? (
            <div className="divide-y divide-slate-100">
              {items.map((art) => {
                const meta = parseMeta(art.metadataJson);
                const fileUrl = normalizeFileUrl(meta.fileUrl);
                return (
                  <div
                    key={art.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-slate-900">
                        {art.name}
                      </p>
                      <p className="text-slate-500">{art.subtitle}</p>
                      {meta.articleBody && (
                        <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 max-w-2xl">
                          {meta.articleBody}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Attachment</span>
                        </a>
                      )}
                      <button
                        onClick={() => openEditModal(art)}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() =>
                          mutate(
                            "DELETE_MANAGE_ITEM",
                            { id: art.id },
                            `Deleted article "${art.name}"`
                          )
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                "Getting Started for Partners",
                "Deal Registration & Protection",
                "Commissions, Payouts & Billing",
                "Account Mapping & Co-Selling",
              ].map((colName) => (
                <div
                  key={colName}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1"
                >
                  <p className="font-bold text-slate-900">{colName}</p>
                  <p className="text-slate-500">
                    Visible to Active Partner Programs
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
