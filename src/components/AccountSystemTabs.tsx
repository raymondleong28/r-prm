"use client";

import React from "react";
import { StatusBadge } from "@/components/SharedEngines";
import {
  Plus,
  Database,
  AlertTriangle,
  Code2,
  Check,
  History,
} from "lucide-react";

interface AccountSystemTabsProps {
  activeTab: string;
  propertyObjects: readonly string[];
  propObject: string;
  setPropObject: (obj: string) => void;
  newPropName: string;
  setNewPropName: (val: string) => void;
  newPropType: string;
  setNewPropType: (val: string) => void;
  handleAddProperty: (e: React.FormEvent) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customProps: any[];
  resetConfirmationText: string;
  setResetConfirmationText: (val: string) => void;
  showToast: (msg: string) => void;
  currentOrigin: string;
  workspaceSlug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiTokens: any[];
  createdTokenPlaintext: string | null;
  newTokenName: string;
  setNewTokenName: (val: string) => void;
  handleCreateToken: (e: React.FormEvent) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload?: any, successMessage?: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLogs: any[];
}

export function AccountSystemTabs({
  activeTab,
  propertyObjects,
  propObject,
  setPropObject,
  newPropName,
  setNewPropName,
  newPropType,
  setNewPropType,
  handleAddProperty,
  customProps,
  resetConfirmationText,
  setResetConfirmationText,
  showToast,
  currentOrigin,
  workspaceSlug,
  apiTokens,
  createdTokenPlaintext,
  newTokenName,
  setNewTokenName,
  handleCreateToken,
  mutate,
  auditLogs,
}: AccountSystemTabsProps) {
  return (
    <>
      {activeTab === "properties" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Custom Properties Builder (10 Object Types)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {propertyObjects.map((obj) => (
              <button
                key={obj}
                onClick={() => setPropObject(obj)}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  propObject === obj
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {obj}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleAddProperty}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
          >
            <div className="flex-1 min-w-[180px]">
              <label className="block font-medium text-slate-700 mb-1">
                New {propObject} Property Label
              </label>
              <input
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
                placeholder="e.g. Regional ERP System"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Field Type
              </label>
              <select
                value={newPropType}
                onChange={(e) => setNewPropType(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option>Single line text</option>
                <option>Number</option>
                <option>Email</option>
                <option>Checkbox</option>
                <option>Single select</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add property</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100">
            {customProps.map((cp) => (
              <div
                key={cp.id}
                className="py-2.5 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900">{cp.name}</p>
                  <p className="text-slate-500">{cp.subtitle}</p>
                </div>
                <StatusBadge status={cp.status} />
              </div>
            ))}
          </div>
        </div>
      )}

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
            <h2 className="text-base font-bold text-slate-900">
              JavaScript Tracking Snippet (r.js) &amp; API Access Tokens
            </h2>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 text-blue-200 font-mono text-[11px] overflow-x-auto">
            {`<script src="${currentOrigin || ""}/r.js" data-account="${workspaceSlug}" async></script>`}
          </div>
          <button
            onClick={() => showToast("Verified r.js snippet configuration!")}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Verify installation</span>
          </button>

          <div className="pt-3 border-t border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">
              API Access Tokens ({apiTokens.length}) — Shown Once at Creation,
              Stored Hashed
            </h3>

            {createdTokenPlaintext && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                <p className="font-bold">
                  Copy your new API token now — it will never be displayed in
                  plaintext again:
                </p>
                <p className="font-mono bg-white px-3 py-1.5 rounded border border-emerald-200 select-all">
                  {createdTokenPlaintext}
                </p>
              </div>
            )}

            <form onSubmit={handleCreateToken} className="flex gap-2">
              <input
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="New token name (e.g. ERP Webhook Sync)"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                + New token
              </button>
            </form>

            <div className="divide-y divide-slate-100">
              {apiTokens.map((tk) => (
                <div
                  key={tk.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">{tk.name}</p>
                    <p className="text-slate-500 font-mono">{tk.subtitle}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={tk.status} />
                    <button
                      onClick={() =>
                        mutate(
                          "DELETE_MANAGE_ITEM",
                          { id: tk.id },
                          `Revoked API token "${tk.name}"`
                        )
                      }
                      className="px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
