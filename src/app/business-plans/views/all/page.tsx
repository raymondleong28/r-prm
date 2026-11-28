"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { useListControls } from "@/components/useListControls";
import {
  SUPPORTED_CURRENCIES,
  currentIsoDateInTimezone,
} from "@/lib/prmEngine";
import { X } from "lucide-react";

export default function BusinessPlansListPage() {
  const { businessPlans, partners, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];

  const [form, setForm] = useState({
    name: "",
    partnerName: "",
    description: "",
    startDate: "",
    endDate: "",
    targetRevBase: "",
    status: "Active",
  });

  const openModal = () => {
    const start = currentIsoDateInTimezone(acct.timezone);
    setForm({
      name: "",
      partnerName: partners[0]?.name || "",
      description: "",
      startDate: start,
      endDate: "",
      targetRevBase: "",
      status: "Active",
    });
    setModalOpen(true);
  };

  const viewRows = businessPlans.filter((bp) => {
    if (activeView !== "All" && bp.status !== activeView) return false;
    if (
      search &&
      !`${bp.name} ${bp.partnerName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const list = useListControls("business-plans", viewRows, {
    dateField: "startDate",
    dateLabel: "Start date",
  });
  const filtered = list.pageRows;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_BUSINESS_PLAN",
      form,
      `Joint Business Plan "${form.name}" created!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={list.filteredRows}
        controls={list}
        title="Business plans"
        countLabel={`${list.filteredCount} business plans`}
        views={["All", "Draft", "Active"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add a new business plan"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Partner</th>
                <th className="py-3 px-3 font-semibold">Partner owner</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Start date</th>
                <th className="py-3 px-3 font-semibold">End date</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Target ({baseCurrency})
                </th>
                <th className="py-3 px-4 font-semibold">Achieved %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((bp) => (
                <tr key={bp.id} className="hover:bg-blue-50/40">
                  <td className="py-3.5 px-4 font-bold text-blue-700">
                    <Link
                      href={`/business-plans/${bp.id}`}
                      className="hover:underline"
                    >
                      {bp.name}
                    </Link>
                    <p className="text-[11px] font-normal text-slate-500">
                      {bp.description}
                    </p>
                  </td>
                  <td className="py-3.5 px-3 font-medium text-blue-700">
                    {bp.partnerName}
                  </td>
                  <td className="py-3.5 px-3 text-slate-700">
                    {bp.partnerOwner || "—"}
                  </td>
                  <td className="py-3.5 px-3">
                    <StatusBadge status={bp.status} />
                  </td>
                  <td className="py-3.5 px-3 text-slate-600">
                    {bp.startDate || "—"}
                  </td>
                  <td className="py-3.5 px-3 text-slate-600">
                    {bp.endDate || "—"}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-900">
                    {baseCurrency} {(bp.targetRevBase || 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 w-48">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${bp.achievedPct}%` }}
                          className="h-full bg-blue-600 rounded-full"
                        />
                      </div>
                      <span className="font-bold text-blue-700">
                        {bp.achievedPct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add a new business plan</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Joint Annual Growth Plan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Partner *
                  </label>
                  <select
                    required
                    value={form.partnerName}
                    onChange={(e) =>
                      setForm({ ...form, partnerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Target Revenue ({baseCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.targetRevBase}
                    onChange={(e) =>
                      setForm({ ...form, targetRevBase: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Goals, milestones, and enablement actions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
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
                Create Plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
