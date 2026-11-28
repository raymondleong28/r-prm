"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { useListControls } from "@/components/useListControls";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { X, RotateCcw } from "lucide-react";

export default function RewardsListPage() {
  const { rewards, partners, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const [refuseRewardId, setRefuseRewardId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  const [form, setForm] = useState({
    partnerName: "",
    type: "Cash",
    amount: "",
    currency: "",
    comment: "",
    oneTimeCommission: "Yes",
  });

  const openModal = () => {
    setForm({
      partnerName: partners[0]?.name || "",
      type: "Cash",
      amount: "",
      currency: baseCurrency,
      comment: "",
      oneTimeCommission: "Yes",
    });
    setModalOpen(true);
  };

  const viewRows = rewards.filter((r) => {
    if (
      activeView === "Due" &&
      !["Pending", "Accepted"].includes(r.status)
    )
      return false;
    if (activeView === "Paid" && r.status !== "Paid") return false;
    if (
      search &&
      !`${r.rewardNumber} ${r.partnerName} ${r.fromActivity}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const list = useListControls("rewards", viewRows, {
    dateField: "createdAt",
    dateLabel: "Creation date",
  });
  const filtered = list.pageRows;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_REWARD",
      {
        ...form,
        currency: form.currency || baseCurrency,
      },
      `Commission reward created for ${form.partnerName}!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={list.filteredRows}
        controls={list}
        title="Rewards"
        countLabel={`${list.filteredCount} rewards`}
        views={["All", "Due", "Paid"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Create reward"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Reward #</th>
                <th className="py-3 px-3 font-semibold">Recipient</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Amount ({baseCurrency})
                </th>
                <th className="py-3 px-3 font-semibold text-right">Amount</th>
                <th className="py-3 px-3 font-semibold">From Activity</th>
                <th className="py-3 px-3 font-semibold">From Reward</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Payout</th>
                <th className="py-3 px-4 font-semibold text-right">
                  Lifecycle Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link href={`/rewards/${r.id}`} className="hover:underline">
                      {r.rewardNumber}
                    </Link>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {r.recipientName}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{r.type}</td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      (r.amountBase ?? r.amount ?? 0) < 0
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {baseCurrency}{" "}
                    {(r.amountBase ?? r.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {r.currency} {r.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-slate-800">{r.fromActivity}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {r.fromRewardRule}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {r.payoutNumber || "—"}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {r.status === "Pending" && (
                      <>
                        <button
                          onClick={() =>
                            mutate(
                              "UPDATE_REWARD_STATUS",
                              { id: r.id, status: "Accepted" },
                              `Reward ${r.rewardNumber} validated!`
                            )
                          }
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold text-[11px]"
                        >
                          Validate
                        </button>
                        <button
                          onClick={() => {
                            setRefuseRewardId(r.id);
                            setRefuseReason("");
                          }}
                          className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px]"
                        >
                          Refuse...
                        </button>
                      </>
                    )}
                    {(r.status === "Accepted" || r.status === "Paid") &&
                      (r.amountBase ?? r.amount ?? 0) > 0 && (
                        <button
                          onClick={() =>
                            mutate(
                              "CLAWBACK_REWARD",
                              {
                                id: r.id,
                                reason: "Underlying merchant invoice refunded",
                              },
                              `Clawed back ${r.rewardNumber} & created negative adjustment!`
                            )
                          }
                          className="px-2 py-1 rounded border border-amber-500 text-amber-800 hover:bg-amber-50 font-semibold text-[11px] inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clawback</span>
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Reward Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Create reward</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Reward type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Cash</option>
                    <option>Coupon</option>
                    <option>Gift card</option>
                    <option>Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Amount *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
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
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Comment
                </label>
                <textarea
                  rows={2}
                  value={form.comment}
                  onChange={(e) =>
                    setForm({ ...form, comment: e.target.value })
                  }
                  placeholder="Optional reward note..."
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
                Create Reward
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refuse Reward with Reason Modal */}
      {refuseRewardId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!refuseReason.trim()) return;
              await mutate(
                "UPDATE_REWARD_STATUS",
                {
                  id: refuseRewardId,
                  status: "Refused",
                  reason: refuseReason,
                },
                "Reward refused with recorded reason"
              );
              setRefuseRewardId(null);
            }}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Refuse Reward (Reason Required)
              </h3>
              <button
                type="button"
                onClick={() => setRefuseRewardId(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block font-semibold text-slate-700">
                Reason for refusing this commission reward *
              </label>
              <textarea
                required
                rows={3}
                value={refuseReason}
                onChange={(e) => setRefuseReason(e.target.value)}
                placeholder="e.g. Duplicate registration or excluded line item."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRefuseRewardId(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
              >
                Confirm Refusal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
