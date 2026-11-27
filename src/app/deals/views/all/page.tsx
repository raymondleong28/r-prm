"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import {
  EntityListToolbar,
  StatusBadge,
  DEAL_STAGES_10,
} from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { LayoutList, Kanban } from "lucide-react";

export default function DealsListPage() {
  const { deals, settings, session, setGlobalModal, mutate, showToast } =
    usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const filtered = deals.filter((d) => {
    // §3.5.1: Filter on the signed-in user's id
    if (activeView === "My Deals" && d.ownerId !== session?.userId) {
      return false;
    }
    if (activeView === "Pending Deals" && d.status !== "Pending") return false;
    if (
      search &&
      !`${d.name} ${d.company} ${d.partnerName} ${d.clientName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleStageChange = async (dealId: string, newStage: string) => {
    await mutate(
      "UPDATE_DEAL_STAGE",
      { id: dealId, stage: newStage },
      newStage === "Closed Won"
        ? "Deal moved to Closed Won and evaluated against partner tier commission rules!"
        : `Deal moved to "${newStage}"`
    );
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={filtered}
        title="Deals"
        countLabel={`${filtered.length} deals`}
        views={["All", "My Deals", "Pending Deals"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Register deal"
        onPrimaryAction={() => setGlobalModal("register_deal")}
        extraRightControls={
          <div className="flex items-center space-x-2 mr-1">
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 ${
                  viewMode === "kanban"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
            <button
              onClick={() => showToast("Kanban pipeline stages customized")}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              customize board
            </button>
          </div>
        }
      />

      {viewMode === "kanban" ? (
        <div className="max-w-[1440px] mx-auto px-6 py-5 overflow-x-auto">
          <div className="flex space-x-4 min-w-[2350px] pb-4">
            {DEAL_STAGES_10.map((stage) => {
              const stageDeals = filtered.filter((d) => d.stage === stage);
              const totalBase = stageDeals.reduce(
                (acc, d) => acc + Number(d.amountBase || 0),
                0
              );
              return (
                <div
                  key={stage}
                  className="w-64 shrink-0 bg-slate-100/90 rounded-xl border border-slate-200 p-3 flex flex-col space-y-3"
                >
                  <div className="pb-2 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {stage}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full">
                        {stageDeals.length}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-blue-700 mt-1">
                      {baseCurrency} {totalBase.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {stageDeals.map((d) => (
                      <div
                        key={d.id}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2 text-xs"
                      >
                        <Link
                          href={`/deals/${d.id}`}
                          className="font-bold text-blue-700 hover:underline block leading-snug"
                        >
                          {d.name}
                        </Link>
                        <p className="text-slate-600 truncate">
                          Partner: <strong>{d.partnerName}</strong>
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">
                            {d.currency} {d.amount.toLocaleString()}
                          </span>
                          <StatusBadge status={d.status} />
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Move stage:
                          </label>
                          <select
                            value={d.stage}
                            onChange={(e) =>
                              handleStageChange(d.id, e.target.value)
                            }
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-slate-50 text-[11px] font-medium text-slate-700"
                          >
                            {DEAL_STAGES_10.map((s) => (
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
      ) : (
        <div className="max-w-[1440px] mx-auto px-6 py-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-3 font-semibold">Owner</th>
                  <th className="py-3 px-3 font-semibold">Client</th>
                  <th className="py-3 px-3 font-semibold">Company</th>
                  <th className="py-3 px-3 font-semibold text-right">
                    Total Amount
                  </th>
                  <th className="py-3 px-3 font-semibold text-right">
                    Total Amount ({baseCurrency})
                  </th>
                  <th className="py-3 px-3 font-semibold">Partner(s)</th>
                  <th className="py-3 px-3 font-semibold">
                    Assigned contact(s)
                  </th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">Stage</th>
                  <th className="py-3 px-3 font-semibold">
                    Date entered current stage
                  </th>
                  <th className="py-3 px-3 font-semibold">Source</th>
                  <th className="py-3 px-3 font-semibold">Close Date</th>
                  <th className="py-3 px-3 font-semibold">Expiration date</th>
                  <th className="py-3 px-4 font-semibold">Source partner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-blue-50/40">
                    <td className="py-3 px-4 font-bold text-blue-700">
                      <Link href={`/deals/${d.id}`} className="hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {d.owner || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{d.clientName}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {d.company}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {d.currency} {d.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-blue-700">
                      {baseCurrency} {Number(d.amountBase || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-blue-600 font-medium">
                      {d.partnerName}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {d.assignedContact || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={d.stage}
                        onChange={(e) =>
                          handleStageChange(d.id, e.target.value)
                        }
                        className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold bg-white"
                      >
                        {DEAL_STAGES_10.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {d.stageEnteredAt || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{d.source}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {d.closeDate || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {d.expirationDate || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {d.sourcePartnerName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
