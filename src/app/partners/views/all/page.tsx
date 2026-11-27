"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export default function PartnersListPage() {
  const { partners, settings, session, setGlobalModal } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const filtered = partners.filter((p) => {
    // §3.5.1: Filter on the signed-in user's id
    if (activeView === "My Partners" && p.ownerId !== session?.userId) {
      return false;
    }
    if (activeView === "Pending Applications" && p.status !== "Pending") {
      return false;
    }
    if (
      activeView === "Platform Partner" &&
      p.partnerType !== "Technology Partner"
    ) {
      return false;
    }
    if (
      search &&
      !`${p.name} ${p.programName} ${p.owner} ${p.groupName}`
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
        title="Partners"
        countLabel={`${filtered.length} partners`}
        views={[
          "All",
          "My Partners",
          "Pending Applications",
          "Weekly Report",
          "Platform Partner",
        ]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        dateFilterLabel="Active since"
        primaryActionLabel="Add a new partner"
        onPrimaryAction={() => setGlobalModal("add_partner")}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-3.5 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Owner</th>
                <th className="py-3 px-3 font-semibold">Group</th>
                <th className="py-3 px-3 font-semibold">Program</th>
                <th className="py-3 px-3 font-semibold">Qualifying level</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Onboarding status</th>
                <th className="py-3 px-3 font-semibold">Onboarding</th>
                <th className="py-3 px-3 font-semibold">Active since</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Submitted leads (365d)
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Registered deals (365d)
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Pending rewards (All time)
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Partner-sourced revenue (365d)
                </th>
                <th className="py-3 px-3.5 font-semibold text-right">
                  Partner-influenced revenue (365d)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    No partners found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40">
                    <td className="py-3 px-3.5 font-bold text-blue-700">
                      <Link
                        href={`/partners/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {p.owner || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {p.groupName || "—"}
                    </td>
                    <td className="py-3 px-3 text-blue-600 font-medium">
                      {p.programId ? (
                        <Link
                          href={`/programs/${p.programId}`}
                          className="hover:underline"
                        >
                          {p.programName || p.programId}
                        </Link>
                      ) : (
                        <span className="text-slate-600">
                          {p.programName || "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                        {p.qualifyingLevel || "Standard"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={p.onboardingStatus} />
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {p.onboardingPipeline || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {p.activeSince || "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {p.submittedLeads365d}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {p.registeredDeals365d}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-blue-700">
                      {baseCurrency}{" "}
                      {Number(p.pendingRewardsAll || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {baseCurrency}{" "}
                      {Number(p.sourcedRevenue365d || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-700 font-medium">
                      {baseCurrency}{" "}
                      {Number(p.influencedRev365d || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
