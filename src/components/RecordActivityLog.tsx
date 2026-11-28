"use client";

import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePrm } from "@/context/PrmContext";

/** Shows the audit-log entries recorded for one record (sync attempts, edits, stage changes). */
export function RecordActivityLog({ objectId, label = "View log" }: { objectId: string; label?: string }) {
  const { auditLogs } = usePrm();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = (auditLogs || []).filter((l: any) => l.objectId === objectId);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
      >
        <RefreshCw className="w-3 h-3" />
        <span>{open ? "Hide log" : `${label} (${entries.length})`}</span>
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50">
          {entries.length === 0 && <p className="p-2 text-slate-500">Nothing recorded for this record yet.</p>}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {entries.map((l: any) => (
            <div key={l.id} className="p-2">
              <p className="text-slate-800">{l.summary}</p>
              <p className="text-[10px] text-slate-500">
                {l.action} · {l.actor} · {l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
