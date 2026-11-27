"use client";

import React from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";

const TYPES = ["Customer", "Opportunity", "Prospect"] as const;

export default function AccountMappingOverviewPage() {
  const { accounts, collaborations, partners } = usePrm();

  const overlaps = accounts.filter((a) => a.hasOverlap);

  const countCell = (yourType: string, partnerType: string) =>
    overlaps.filter(
      (a) => a.type === yourType && a.partnerAccountType === partnerType
    ).length;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Account Mapping Overview
          </h1>
          <p className="text-xs text-slate-500">
            Cross-reference your CRM accounts with partner ecosystems to spot co-selling overlaps
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="/data-sources"
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            Manage data sources
          </Link>
          <Link
            href="/overlaps/views/all"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            Explore All Overlaps ({overlaps.length}) →
          </Link>
        </div>
      </div>

      {/* 3x3 Overlaps Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-sm text-slate-900 mb-1">
          Overlaps matrix
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Your Customers / Opportunities / Prospects × Partner Customers / Opportunities / Prospects
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-3 px-4 text-left font-bold">
                  Your Accounts ↓ \ Partner Accounts →
                </th>
                <th className="py-3 px-4 font-bold text-blue-700">
                  Partner Customers
                </th>
                <th className="py-3 px-4 font-bold text-blue-700">
                  Partner Opportunities
                </th>
                <th className="py-3 px-4 font-bold text-blue-700">
                  Partner Prospects
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {TYPES.map((yourT) => (
                <tr key={yourT}>
                  <td className="py-4 px-4 text-left font-bold text-slate-900 bg-slate-50">
                    Your {yourT === "Opportunity" ? "Opportunities" : `${yourT}s`}
                  </td>
                  {TYPES.map((partT) => {
                    const c = countCell(yourT, partT);
                    return (
                      <td
                        key={partT}
                        className={`py-4 px-4 border-l border-slate-100 ${
                          c > 0 ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <Link
                          href="/overlaps/views/all"
                          className="inline-flex flex-col items-center group"
                        >
                          <span
                            className={`text-2xl font-extrabold ${
                              c > 0
                                ? "text-blue-700 group-hover:underline"
                                : "text-slate-400"
                            }`}
                          >
                            {c}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            overlaps
                          </span>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Tables: Recent overlaps, Top partners, Recent collaboration updates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Recent overlaps */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">
              Recent overlaps
            </h3>
            <Link
              href="/overlaps/views/all"
              className="text-blue-600 hover:underline font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {overlaps.map((o) => (
              <div key={o.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{o.accountName}</p>
                  <p className="text-slate-500">
                    {o.partnerName} · Your {o.type}
                  </p>
                </div>
                <span className="text-slate-400">{o.overlapDate}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top partners by overlaps */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Top partners</h3>
            <Link
              href="/partners/views/all"
              className="text-blue-600 hover:underline font-medium"
            >
              Directory →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {partners.slice(0, 5).map((p) => {
              const pOverlaps = overlaps.filter((o) => o.partnerName === p.name);
              return (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-blue-700">{p.name}</p>
                    <p className="text-slate-500">{p.programName}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                    {pOverlaps.length} overlaps
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent collaboration updates */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">
              Recent collaboration updates
            </h3>
            <Link
              href="/collaborations/views/all"
              className="text-blue-600 hover:underline font-medium"
            >
              Collaborations →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {collaborations.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-slate-500">
                    {c.partnerName} · {c.accountName}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
