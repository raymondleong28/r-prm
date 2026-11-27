"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { ArrowRight } from "lucide-react";

const PROSPECTION_COLUMNS = ["New", "Onboarding", "Active"] as const;

export default function PartnerProspectionPage() {
  const { partners, session, mutate, setGlobalModal, showToast } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = partners.filter((p) => {
    // §3.5.1: Filter on the signed-in user's id
    if (activeView === "My Prospects" && p.ownerId !== session?.userId) {
      return false;
    }
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const moveStage = async (id: string, nextStage: string) => {
    await mutate(
      "UPDATE_PARTNER",
      {
        id,
        data: {
          prospectionStage: nextStage,
          status: nextStage === "Active" ? "Active" : nextStage,
        },
      },
      `Partner moved to ${nextStage}`
    );
  };

  return (
    <div>
      <EntityListToolbar
        title="Partners prospection"
        countLabel={`${filtered.length} prospects`}
        views={["All", "My Prospects"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        dateFilterLabel="Active since"
        primaryActionLabel="New prospect"
        onPrimaryAction={() => setGlobalModal("add_partner")}
        extraRightControls={
          <button
            onClick={() => showToast("Board column layout customized")}
            className="text-xs font-semibold text-blue-600 hover:underline mr-2"
          >
            customize board
          </button>
        }
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        {PROSPECTION_COLUMNS.map((col) => {
          const items = filtered.filter((p) => p.prospectionStage === col);
          return (
            <div
              key={col}
              className="bg-slate-100/80 rounded-xl border border-slate-200 p-4 flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-900">{col}</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/partners/${p.id}`}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-slate-600 space-y-0.5">
                      <p>Partner type: {p.partnerType || "—"}</p>
                      <p>Program level: {p.qualifyingLevel || "Standard"}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Owner: {p.owner || "Unassigned"}
                      </span>
                      {col !== "Active" && (
                        <button
                          onClick={() =>
                            moveStage(
                              p.id,
                              col === "New" ? "Onboarding" : "Active"
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
                        >
                          <span>
                            Move to {col === "New" ? "Onboarding" : "Active"}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
