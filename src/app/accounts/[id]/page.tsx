"use client";

import React from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { normalizeAccountKey } from "@/lib/prmEngine";

export default function AccountRecordDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { accounts, mutate } = usePrm();

  const acc = accounts.find((a) => a.id === id);
  if (!acc) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/accounts/views/all" label="Accounts" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No mapped account found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb href="/accounts/views/all" label="Accounts" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">
              {acc.accountName}
            </h1>
            <StatusBadge status={acc.type} />
          </div>
        </div>
        <button
          onClick={() =>
            mutate(
              "CREATE_COLLABORATION",
              {
                name: `Co-Sell Intro: ${acc.accountName}`,
                partnerName: acc.partnerName,
                assignedContact: acc.partnerOwnerName,
                accountName: acc.accountName,
              },
              `Started collaboration with ${acc.partnerName}!`
            )
          }
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
        >
          Start Co-Selling Collaboration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <h3 className="font-bold text-sm text-slate-900">
            Your CRM Account Record
          </h3>
          <p>
            Account Name: <strong>{acc.accountName}</strong>
          </p>
          <p>
            Normalized Match Key:{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">
              {normalizeAccountKey(acc.accountName)}
            </code>
          </p>
          <p>
            Account Owner: {acc.ownerName} ({acc.ownerEmail})
          </p>
          <p>Data Source: {acc.source}</p>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm space-y-2">
          <h3 className="font-bold text-sm text-blue-800">
            Overlapping Partner Roster Match
          </h3>
          <p>
            Partner: <strong>{acc.partnerName}</strong>
          </p>
          <p>
            Partner Account Name:{" "}
            <strong>{acc.partnerAccountName || acc.accountName}</strong> (
            {acc.partnerAccountType})
          </p>
          <p>
            Partner Owner: {acc.partnerOwnerName} ({acc.partnerOwnerEmail})
          </p>
          <p>Computed Overlap Status: {acc.hasOverlap ? "Matched" : "No Overlap"}</p>
        </div>
      </div>
    </div>
  );
}
