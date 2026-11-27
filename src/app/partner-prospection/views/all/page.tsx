"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import {
  readProspectionSettings,
  type ProspectionCardFieldId,
} from "@/lib/prospectionSettings";

const NOT_IN_A_COLUMN = "__none__";

type ProspectPartner = {
  id: string;
  name: string;
  ownerId?: string | null;
  owner?: string | null;
  status?: string | null;
  prospectionStage?: string | null;
  partnerType?: string | null;
  qualifyingLevel?: string | null;
  programName?: string | null;
  country?: string | null;
  createdAt?: string | null;
};

function cardLine(p: ProspectPartner, field: ProspectionCardFieldId): React.ReactNode {
  switch (field) {
    case "partnerType":
      return <p key={field}>Partner type: {p.partnerType || "—"}</p>;
    case "programLevel":
      return <p key={field}>Program level: {p.qualifyingLevel || "—"}</p>;
    case "program":
      return <p key={field}>Program: {p.programName || "—"}</p>;
    case "owner":
      return <p key={field}>Owner: {p.owner || "Unassigned"}</p>;
    case "country":
      return <p key={field}>Country: {p.country || "—"}</p>;
    case "createdAt":
      return (
        <p key={field}>
          Created: {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
        </p>
      );
    default:
      return null;
  }
}

export default function PartnerProspectionPage() {
  const { partners, session, settings, mutate, setGlobalModal } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const { stages, cardFields } = readProspectionSettings(settings?.account_settings);

  const filtered = (partners as ProspectPartner[]).filter((p) => {
    if (activeView === "My Prospects" && p.ownerId !== session?.userId) {
      return false;
    }
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const unplaced = filtered.filter((p) => !stages.includes(String(p.prospectionStage || "")));
  const columns = unplaced.length > 0 ? [...stages, NOT_IN_A_COLUMN] : stages;

  const moveStage = async (id: string, nextStage: string) => {
    await mutate(
      "UPDATE_PARTNER",
      { id, data: { prospectionStage: nextStage } },
      `Moved to ${nextStage}`
    );
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={filtered}
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
          <Link
            href="/account/partners"
            className="text-xs font-semibold text-blue-600 hover:underline mr-2"
          >
            customize board
          </Link>
        }
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5 flex gap-5 overflow-x-auto">
        {columns.map((col) => {
          const items =
            col === NOT_IN_A_COLUMN
              ? unplaced
              : filtered.filter((p) => p.prospectionStage === col);
          return (
            <div
              key={col}
              className="bg-slate-100/80 rounded-xl border border-slate-200 p-4 flex flex-col space-y-3 min-w-[260px] flex-1"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-900">
                  {col === NOT_IN_A_COLUMN ? "Not in a column" : col}
                </span>
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                  {items.length}
                </span>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-slate-400">No partners</p>
              )}
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
                      {cardFields.includes("status") && p.status && (
                        <StatusBadge status={p.status} />
                      )}
                    </div>
                    <div className="text-slate-600 space-y-0.5">
                      {cardFields.filter((f) => f !== "status").map((f) => cardLine(p, f))}
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <select
                        aria-label={`Move ${p.name} to another column`}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) moveStage(p.id, e.target.value);
                        }}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md text-blue-700 font-semibold bg-white"
                      >
                        <option value="">Move to…</option>
                        {stages
                          .filter((s) => s !== p.prospectionStage)
                          .map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                      </select>
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
