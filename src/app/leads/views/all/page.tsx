"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { LeadConvertModal } from "@/components/LeadConvertModal";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export default function LeadsListPage() {
  const { leads, settings, session, setGlobalModal, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [convertingLead, setConvertingLead] = useState<any | null>(null);

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const filtered = leads.filter((l) => {
    // §3.5.1: Filter on the signed-in user's id
    if (activeView === "My Leads" && l.ownerId !== session?.userId) {
      return false;
    }
    if (activeView === "Pending Leads" && l.status !== "Pending") return false;
    if (
      search &&
      !`${l.firstName} ${l.lastName} ${l.company} ${l.sourcePartnerName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <EntityListToolbar
        title="Leads"
        countLabel={`${filtered.length} leads`}
        views={["All", "My Leads", "Pending Leads"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        secondaryActionLabel="Share lead"
        onSecondaryAction={() => setGlobalModal("share_lead")}
        primaryActionLabel="Submit lead"
        onPrimaryAction={() => setGlobalModal("submit_lead")}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Company</th>
                <th className="py-3 px-3 font-semibold">Lead status</th>
                <th className="py-3 px-3 font-semibold">Owner</th>
                <th className="py-3 px-3 font-semibold">Source</th>
                <th className="py-3 px-3 font-semibold">Source partner</th>
                <th className="py-3 px-3 font-semibold">Assigned partner</th>
                <th className="py-3 px-3 font-semibold">Assigned contact</th>
                <th className="py-3 px-3 font-semibold">Assigned date</th>
                <th className="py-3 px-3 font-semibold">Deadline</th>
                <th className="py-3 px-4 font-semibold text-right">
                  Quick Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No leads found.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-blue-50/40">
                    <td className="py-3 px-4 font-bold text-blue-700">
                      <Link href={`/leads/${l.id}`} className="hover:underline">
                        {l.firstName} {l.lastName}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {l.company}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {l.owner || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{l.source}</td>
                    <td className="py-3 px-3 text-blue-600 font-medium">
                      {l.sourcePartnerName || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {l.assignedPartner || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {l.assignedContact || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {l.assignedDate || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {l.deadline || "—"}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {l.status === "Pending" && (
                        <button
                          onClick={() =>
                            mutate(
                              "UPDATE_LEAD_STATUS",
                              { id: l.id, status: "Accepted" },
                              `Lead ${l.firstName} ${l.lastName} accepted!`
                            )
                          }
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold text-[11px]"
                        >
                          Accept
                        </button>
                      )}
                      {l.status !== "Converted" && (
                        <button
                          onClick={() => setConvertingLead(l)}
                          className="px-2.5 py-1 rounded border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold text-[11px]"
                        >
                          Convert to deal
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeadConvertModal
        lead={convertingLead}
        defaultCurrency={baseCurrency}
        onClose={() => setConvertingLead(null)}
        onSubmit={async (payload) => {
          await mutate(
            "CONVERT_LEAD_TO_DEAL",
            payload,
            `Lead converted to Deal (${payload.currency} ${payload.amount.toLocaleString()})!`
          );
        }}
      />
    </div>
  );
}
