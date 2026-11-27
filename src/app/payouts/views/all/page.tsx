"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from "@/lib/prmEngine";
import { Settings, X } from "lucide-react";

export default function PayoutsListPage() {
  const { payouts, partners, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];

  const [form, setForm] = useState({
    period: "All time",
    partnerName: "",
    includeRewards: "Pending or accepted",
    includeType: "Cash",
    currency: "",
    threshold: "",
  });

  const openModal = () => {
    setForm({
      period: "All time",
      partnerName: partners[0]?.name || "",
      includeRewards: "Pending or accepted",
      includeType: "Cash",
      currency: baseCurrency,
      threshold: String(acct.autoPayoutThresholdBase ?? 100),
    });
    setModalOpen(true);
  };

  const filtered = payouts.filter((p) => {
    if (activeView !== "All" && p.status !== activeView) return false;
    if (
      search &&
      !`${p.name} ${p.partnerName} ${p.payoutNumber}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_PAYOUT",
      {
        ...form,
        currency: form.currency || baseCurrency,
      },
      `Payout settlement created for ${form.partnerName}!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={filtered}
        title="Payouts"
        countLabel={`${filtered.length} payouts`}
        views={["All", "Draft", "Pending", "Ready", "Paid"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Create payout"
        onPrimaryAction={openModal}
        extraRightControls={
          <Link
            href="/account?tab=Payouts"
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>Configure</span>
          </Link>
        }
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Partner</th>
                <th className="py-3 px-3 font-semibold text-right">Amount</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Amount ({baseCurrency})
                </th>
                <th className="py-3 px-3 font-semibold">From</th>
                <th className="py-3 px-3 font-semibold">To</th>
                <th className="py-3 px-3 font-semibold text-right">Rewards</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Invoice</th>
                <th className="py-3 px-3 font-semibold">Payout #</th>
                <th className="py-3 px-3 font-semibold">Paid date</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link href={`/payouts/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 font-medium text-blue-700">
                    {p.partnerName}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {p.currency} {p.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {baseCurrency}{" "}
                    {(p.amountBase ?? p.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{p.periodFrom}</td>
                  <td className="py-3 px-3 text-slate-500">{p.periodTo}</td>
                  <td className="py-3 px-3 text-right font-semibold">
                    {p.rewardsCount}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3 px-3 text-blue-600 font-medium">
                    {p.invoiceRef}
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-700">
                    {p.payoutNumber}
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {p.paidDate || "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {p.status !== "Paid" && (
                      <button
                        onClick={() =>
                          mutate(
                            "MARK_PAYOUT_PAID",
                            { id: p.id },
                            `Payout ${p.payoutNumber} marked Paid!`
                          )
                        }
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px]"
                      >
                        Mark Paid
                      </button>
                    )}
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
              <h3 className="font-bold text-sm">Create payout</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Period
                </label>
                <select
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option>All time</option>
                  <option>Current Month</option>
                  <option>Last Quarter</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  For partner *
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Include rewards
                  </label>
                  <select
                    value={form.includeRewards}
                    onChange={(e) =>
                      setForm({ ...form, includeRewards: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Pending or accepted</option>
                    <option>Accepted only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Include rewards with type
                  </label>
                  <select
                    value={form.includeType}
                    onChange={(e) =>
                      setForm({ ...form, includeType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Cash</option>
                    <option>All types</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency || baseCurrency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_LABELS[code] || code} ({code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Threshold (minimum sum)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.threshold}
                    onChange={(e) =>
                      setForm({ ...form, threshold: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
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
                Generate Payout Batch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
