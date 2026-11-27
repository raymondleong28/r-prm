"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import {
  DEFAULT_FX_TABLE,
  SUPPORTED_CURRENCIES,
  convertWithDatedFx,
} from "@/lib/prmEngine";
import { RotateCcw } from "lucide-react";

export default function TransactionDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { transactions, rewards, settings, mutate } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const tx = transactions.find((t) => t.id === id);
  if (!tx) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/transactions/views/all" label="Transactions" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No transaction record found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  const linkedRewards = rewards.filter(
    (r) =>
      r.fromActivity.includes(tx.name) ||
      (tx.dealName && r.fromActivity.includes(tx.dealName))
  );
  const fxRate = convertWithDatedFx(
    tx.amount,
    tx.currency,
    baseCurrency,
    DEFAULT_FX_TABLE
  ).fxRate;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/transactions/views/all" label="Transactions" />
          <h1 className="text-xl font-bold text-slate-900 pt-1">{tx.name}</h1>
        </div>
        {linkedRewards.some((r) => (r.amountBase ?? r.amount ?? 0) > 0) && (
          <button
            onClick={async () => {
              const targetReward = linkedRewards.find(
                (r) => (r.amountBase ?? r.amount ?? 0) > 0
              );
              if (targetReward) {
                await mutate(
                  "CLAWBACK_REWARD",
                  {
                    id: targetReward.id,
                    reason: `Transaction "${tx.name}" refunded`,
                  },
                  `Refund processed! Commission reward ${targetReward.rewardNumber} clawed back.`
                );
              }
            }}
            className="px-3.5 py-2 rounded-lg border border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refund Invoice &amp; Trigger Clawback</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5 h-fit">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Transaction &amp; Dated FX Details
          </h3>
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-slate-500">Original Amount</span>
            <span className="font-bold text-slate-900">
              {tx.currency} {tx.amount.toLocaleString()}
            </span>
            <span className="text-slate-500">
              Converted Base Amount ({baseCurrency})
            </span>
            <span className="font-extrabold text-blue-700">
              {baseCurrency} {(tx.amountBase ?? tx.amount ?? 0).toLocaleString()}
            </span>
            <span className="text-slate-500">Applied FX Rate</span>
            <span className="font-mono">
              1 {tx.currency} = {fxRate} {baseCurrency}
            </span>
            <span className="text-slate-500">FX Rate Date &amp; Source</span>
            <span className="font-medium">
              {DEFAULT_FX_TABLE.rateDate} ({DEFAULT_FX_TABLE.source})
            </span>
            <span className="text-slate-500">Partner</span>
            <span className="font-bold text-blue-700">
              {tx.partnerName || "—"}
            </span>
            <span className="text-slate-500">Customer</span>
            <span className="font-medium">{tx.customerName || "—"}</span>
            <span className="text-slate-500">Deal</span>
            <span className="font-medium">{tx.dealName || "—"}</span>
            <span className="text-slate-500">Billing Month</span>
            <span className="font-medium">{tx.monthKey}</span>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            Generated Commission Rewards ({linkedRewards.length})
          </h3>
          {linkedRewards.length === 0 ? (
            <p className="text-slate-400 py-2">
              No commission rewards linked to this transaction.
            </p>
          ) : (
            linkedRewards.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <Link
                    href={`/rewards/${r.id}`}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {r.rewardNumber} · {r.fromRewardRule}
                  </Link>
                  <p className="text-slate-500">{r.comment}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-bold ${
                      (r.amountBase ?? r.amount ?? 0) < 0
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {baseCurrency}{" "}
                    {(r.amountBase ?? r.amount ?? 0).toLocaleString()}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
