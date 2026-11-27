"use client";

import React from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";

export default function CollaborationDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { collaborations } = usePrm();

  const col = collaborations.find((c) => c.id === id);
  if (!col) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb
          href="/collaborations/views/all"
          label="Collaborations"
        />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No collaboration found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb
            href="/collaborations/views/all"
            label="Collaborations"
          />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{col.name}</h1>
            <StatusBadge status={col.status} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2.5">
        <div className="grid grid-cols-2 gap-y-2 max-w-md">
          <span className="text-slate-500">Target Account</span>
          <span className="font-bold text-slate-900">{col.accountName}</span>
          <span className="text-slate-500">Co-Selling Partner</span>
          <span className="font-bold text-blue-700">{col.partnerName}</span>
          <span className="text-slate-500">Partner Contact</span>
          <span className="font-medium">{col.assignedContact}</span>
          <span className="text-slate-500">Internal Owner</span>
          <span className="font-medium">{col.owner}</span>
          <span className="text-slate-500">Last Activity Date</span>
          <span>{col.lastActivityDate}</span>
        </div>
      </div>
    </div>
  );
}
