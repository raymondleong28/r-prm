"use client";

import React, { useState } from "react";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import {
  DEFAULT_FX_TABLE,
  SUPPORTED_CURRENCIES,
  convertWithDatedFx,
} from "@/lib/prmEngine";
import { RotateCcw } from "lucide-react";

export default function RewardDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { rewards, settings, mutate } = usePrm();
  const [refuseReason, setRefuseReason] = useState("");

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const reward = rewards.find((r) => r.id === id);
  if (!reward) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/rewards/views/all" label="Rewards" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No reward found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  const fxRate = convertWithDatedFx(
    reward.amount,
    reward.currency,
    baseCurrency,
    DEFAULT_FX_TABLE
  ).fxRate;
  const baseAmt = reward.amountBase ?? reward.amount ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/rewards/views/all" label="Rewards" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">
              Reward {reward.rewardNumber} · {reward.partnerName}
            </h1>
            <StatusBadge status={reward.status} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {reward.status === "Pending" && (
            <button
              onClick={() =>
                mutate(
                  "UPDATE_REWARD_STATUS",
                  { id: reward.id, status: "Accepted" },
                  `Reward ${reward.rewardNumber} validated!`
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Validate Reward
            </button>
          )}
          {(reward.status === "Accepted" || reward.status === "Paid") &&
            baseAmt > 0 && (
              <button
                onClick={() =>
                  mutate(
                    "CLAWBACK_REWARD",
                    {
                      id: reward.id,
                      reason: "Underlying invoice refunded by merchant",
                    },
                    `Clawed back ${reward.rewardNumber} and created negative adjustment!`
                  )
                }
                className="px-3.5 py-2 rounded-lg border border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clawback (Reverse Commission)</span>
              </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2.5">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Commission Rule &amp; Dated FX Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-slate-500">Recipient Partner</span>
            <span className="font-bold text-blue-700">
              {reward.recipientName}
            </span>
            <span className="text-slate-500">Value Type</span>
            <span className="font-semibold">{reward.type}</span>
            <span className="text-slate-500">Original Amount</span>
            <span className="font-bold">
              {reward.currency} {reward.amount.toLocaleString()}
            </span>
            <span className="text-slate-500">Base Amount ({baseCurrency})</span>
            <span
              className={`font-extrabold ${
                baseAmt < 0 ? "text-red-600" : "text-blue-700"
              }`}
            >
              {baseCurrency} {baseAmt.toLocaleString()}
            </span>
            <span className="text-slate-500">Dated FX Rate</span>
            <span className="font-mono">
              1 {reward.currency} = {fxRate} {baseCurrency} (
              {DEFAULT_FX_TABLE.rateDate})
            </span>
            <span className="text-slate-500">From Activity</span>
            <span className="font-medium">{reward.fromActivity}</span>
            <span className="text-slate-500">Triggered Rule</span>
            <span className="font-medium">{reward.fromRewardRule}</span>
            <span className="text-slate-500">Payout Batch</span>
            <span className="font-medium">{reward.payoutNumber || "—"}</span>
          </div>
          <p className="text-slate-600 pt-2 border-t border-slate-100">
            Audit Comment: {reward.comment || "None"}
          </p>
        </div>

        {reward.status === "Pending" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 h-fit">
            <h3 className="font-bold text-sm text-slate-900">
              Refuse Reward (Requires Reason)
            </h3>
            <textarea
              rows={3}
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Enter required reason for refusing this commission reward..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <button
              disabled={!refuseReason.trim()}
              onClick={() =>
                mutate(
                  "UPDATE_REWARD_STATUS",
                  {
                    id: reward.id,
                    status: "Refused",
                    reason: refuseReason,
                  },
                  `Reward ${reward.rewardNumber} refused with reason`
                )
              }
              className="px-4 py-2 rounded-lg bg-amber-600 disabled:bg-slate-200 text-white font-semibold"
            >
              Refuse with Reason
            </button>
          </div>
        )}
      </div>
      <CustomFieldsPanel objectType="Rewards" recordId={reward.id} stored={reward.customFieldsJson} />
    </div>
  );
}
