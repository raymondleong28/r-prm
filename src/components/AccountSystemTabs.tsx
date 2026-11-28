"use client";

import React from "react";
import { ApiTokensPanel } from "@/components/ApiTokensPanel";
import { CustomFieldsBuilder } from "@/components/CustomFields";
import {
  Database,
  AlertTriangle,
  Code2,
  History,
} from "lucide-react";

interface AccountSystemTabsProps {
  activeTab: string;
  resetConfirmationText: string;
  setResetConfirmationText: (val: string) => void;
  showToast: (msg: string) => void;
  currentOrigin: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload?: any, successMessage?: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLogs: any[];
}

export function AccountSystemTabs({
  activeTab,
  resetConfirmationText,
  setResetConfirmationText,
  showToast,
  currentOrigin,
  mutate,
  auditLogs,
}: AccountSystemTabsProps) {
  return (
    <>
      {activeTab === "properties" && <CustomFieldsBuilder />}

      {activeTab === "data" && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Account data — Protected Reset
            </h2>
          </div>
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">
                  Danger Zone — Protected Data Reset
                </p>
                <p className="text-amber-800">
                  Destructive resets are disabled by default and require
                  explicit owner approval and typing <code>RESET</code> below.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder='Type "RESET" to enable button...'
                className="px-3 py-1.5 border border-amber-300 rounded-lg bg-white"
              />
              <button
                disabled={resetConfirmationText !== "RESET"}
                onClick={() => {
                  showToast(
                    "Protected mode: Ask the workspace owner before running a destructive reset."
                  );
                  setResetConfirmationText("");
                }}
                className={`px-4 py-1.5 rounded-lg font-semibold ${
                  resetConfirmationText === "RESET"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Reset data
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "integration" && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Integration</h2>
          </div>
          <ApiTokensPanel origin={currentOrigin} onToast={showToast} />
        </div>
      )}

      {activeTab === "audit-log" && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <History className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Immutable Audit Log ({auditLogs.length} Events)
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-slate-500 py-4">
                No audit entries recorded yet.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-2.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-900">
                        {log.objectType} ({log.objectId})
                      </span>
                      <span className="text-slate-500">
                        by {log.actor} · {log.actorRole}
                      </span>
                    </div>
                    <p className="text-slate-700 mt-0.5">{log.summary}</p>
                  </div>
                  <span className="text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
