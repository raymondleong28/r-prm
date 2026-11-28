"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { Kanban, LayoutList } from "lucide-react";
import { useListControls } from "@/components/useListControls";
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
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const { stages, cardFields } = readProspectionSettings(settings?.account_settings);

  const viewRows = (partners as ProspectPartner[]).filter((p) => {
    if (activeView === "My Prospects" && p.ownerId !== session?.userId) {
      return false;
    }
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });
  const list = useListControls("prospection", viewRows, {
    dateField: "activeSince",
    dateLabel: "Active since",
  });
  const filtered = viewMode === "board" ? list.filteredRows : list.pageRows;

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
        exportRows={list.filteredRows}
        controls={list}
        title="Partners prospection"
        countLabel={`${list.filteredCount} prospects`}
        views={["All", "My Prospects"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="New prospect"
        onPrimaryAction={() => setGlobalModal("add_partner")}
        extraRightControls={
          <div className="flex items-center space-x-2 mr-1">
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
              {(["board", "list"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 ${
                    viewMode === m ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m === "board" ? <Kanban className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
                  <span>{m === "board" ? "Board" : "List"}</span>
                </button>
              ))}
            </div>
            <Link href="/account/partners" className="text-xs font-semibold text-blue-600 hover:underline">
              customize board
            </Link>
          </div>
        }
      />

      {viewMode === "list" && (
        <div className="max-w-[1440px] mx-auto px-6 py-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-3 font-semibold">Column</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">Partner type</th>
                  <th className="py-3 px-3 font-semibold">Program level</th>
                  <th className="py-3 px-3 font-semibold">Owner</th>
                  <th className="py-3 px-3 font-semibold">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-slate-400">No prospects match.</td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40">
                    <td className="py-3 px-4 font-bold">
                      <Link href={`/partners/${p.id}`} className="text-blue-700 hover:underline">{p.name}</Link>
                    </td>
                    <td className="py-3 px-3">
                      {stages.includes(String(p.prospectionStage || "")) ? p.prospectionStage : "Not in a column"}
                    </td>
                    <td className="py-3 px-3">{p.status ? <StatusBadge status={p.status} /> : "—"}</td>
                    <td className="py-3 px-3">{p.partnerType || "—"}</td>
                    <td className="py-3 px-3">{p.qualifyingLevel || "—"}</td>
                    <td className="py-3 px-3">{p.owner || "Unassigned"}</td>
                    <td className="py-3 px-3">{p.country || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === "board" && (
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
      )}
    </div>
  );
}
