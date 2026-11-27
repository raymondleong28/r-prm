"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { X } from "lucide-react";

export default function ProgramsListPage() {
  const { programs, manageItems, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [programName, setProgramName] = useState("");
  const [onboardingPipelineId, setOnboardingPipelineId] =
    useState("Default Onboarding");

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];
  const pipelines = manageItems.filter(
    (m) => m.category === "onboarding_pipelines"
  );

  const filtered = programs.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_PROGRAM",
      {
        name: programName,
        onboardingPipelineId:
          onboardingPipelineId.trim() || "Default Onboarding",
      },
      `Partner program "${programName}" created!`
    );
    setProgramName("");
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        title="Programs"
        countLabel={`${filtered.length} programs`}
        views={["All"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add a new program"
        onPrimaryAction={() => setModalOpen(true)}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Levels</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Partner Count
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Pending Applications
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Submitted leads (Last 365 days)
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Registered deals (Last 365 days)
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Partner-sourced revenue (Last 365 days)
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Partner-influenced revenue (Last 365 days)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No partner programs created yet.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  let levelsCount = 0;
                  try {
                    levelsCount = JSON.parse(p.levelsJson || "[]").length;
                  } catch {
                    levelsCount = 0;
                  }
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40">
                      <td className="py-3.5 px-4 font-bold text-blue-700">
                        <Link
                          href={`/programs/${p.id}`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                          {levelsCount} Levels
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold">
                        {p.partnerCount}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-blue-700">
                        {p.pendingApplications}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {p.submittedLeads365d}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {p.registeredDeals365d}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        {baseCurrency}{" "}
                        {Number(p.sourcedRevenue365d || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {baseCurrency}{" "}
                        {Number(p.influencedRev365d || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add new partner program</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Program name *
                </label>
                <input
                  required
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Acme Partner Program"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Onboarding pipeline *
                </label>
                {pipelines.length > 0 ? (
                  <select
                    value={onboardingPipelineId}
                    onChange={(e) => setOnboardingPipelineId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {pipelines.map((pl) => (
                      <option key={pl.id} value={pl.name}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={onboardingPipelineId}
                    onChange={(e) => setOnboardingPipelineId(e.target.value)}
                    placeholder="Default Onboarding"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                )}
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Create Program
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
