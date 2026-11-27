"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";

export default function OverlapsListPage() {
  const { accounts, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");

  const overlaps = accounts.filter((a) => {
    if (!a.hasOverlap) return false;
    if (
      activeView === "Prospects vs Partner Customers" &&
      !(a.type === "Prospect" && a.partnerAccountType === "Customer")
    )
      return false;
    if (
      activeView === "Customers vs Partner Prospects" &&
      !(a.type === "Customer" && a.partnerAccountType === "Prospect")
    )
      return false;
    if (
      search &&
      !`${a.accountName} ${a.partnerName}`
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
        title="Overlaps"
        countLabel={`${overlaps.length} overlaps`}
        views={[
          "All",
          "Prospects vs Partner Customers",
          "Customers vs Partner Prospects",
        ]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        dateFilterLabel="Overlap date"
        extraRightControls={
          <Link
            href="/data-sources"
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            Manage data sources
          </Link>
        }
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              {/* Grouped Column Bands */}
              <tr className="border-b border-slate-200 bg-blue-50/70 text-blue-900 font-bold">
                <th colSpan={4} className="py-2 px-4 border-r border-blue-100">
                  Your accounts
                </th>
                <th colSpan={5} className="py-2 px-4 border-r border-blue-100">
                  Partner accounts
                </th>
                <th colSpan={2} className="py-2 px-4">
                  Overlap details
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-2.5 px-4 font-semibold">Account name</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Owner name</th>
                <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                  Owner email
                </th>
                <th className="py-2.5 px-3 font-semibold">Partner</th>
                <th className="py-2.5 px-3 font-semibold">Account name</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Owner name</th>
                <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                  Owner email
                </th>
                <th className="py-2.5 px-3 font-semibold">Overlap date</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  Co-Sell
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {overlaps.map((o) => (
                <tr key={o.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {o.accountName}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={o.type} />
                  </td>
                  <td className="py-3 px-3 text-slate-700">{o.ownerName}</td>
                  <td className="py-3 px-3 text-slate-500 border-r border-slate-100">
                    {o.ownerEmail}
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-700">
                    {o.partnerName}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {o.partnerAccountName || o.accountName}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={o.partnerAccountType} />
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {o.partnerOwnerName}
                  </td>
                  <td className="py-3 px-3 text-slate-500 border-r border-slate-100">
                    {o.partnerOwnerEmail}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{o.overlapDate}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() =>
                        mutate(
                          "CREATE_COLLABORATION",
                          {
                            name: `Co-Sell Intro: ${o.accountName}`,
                            partnerName: o.partnerName,
                            assignedContact: o.partnerOwnerName,
                            accountName: o.accountName,
                          },
                          `Collaboration started with ${o.partnerName} on ${o.accountName}!`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px]"
                    >
                      Collaborate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
