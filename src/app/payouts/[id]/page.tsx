"use client";

import React from "react";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { FileText, CheckCircle2 } from "lucide-react";

export default function PayoutDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { payouts, rewards, partners, settings, mutate, showToast } = usePrm();

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];

  const payout = payouts.find((p) => p.id === id);
  if (!payout) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/payouts/views/all" label="Payouts" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No payout found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  const partner = partners.find((p) => p.name === payout.partnerName);
  const bundledRewards = rewards.filter((r) => r.payoutId === payout.id);
  const issuerName = acct.legalEntityName || acct.accountName || "Workspace";
  const issuerAddress = acct.billingAddress || "Address not configured";

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/payouts/views/all" label="Payouts" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">
              {payout.payoutNumber} · {payout.name}
            </h1>
            <StatusBadge status={payout.status} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {payout.status !== "Paid" && (
            <button
              onClick={() =>
                mutate(
                  "MARK_PAYOUT_PAID",
                  { id: payout.id },
                  `Payout ${payout.payoutNumber} marked Paid!`
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark as Paid</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Self-Invoicing Document Preview */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-blue-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm">
              <FileText className="w-4 h-4" />
              <span>Generated Self-Invoice ({payout.invoiceRef})</span>
            </div>
            {acct.selfInvoicingEnabled ? (
              <a
                href={`/api/payouts/${payout.id}/invoice`}
                className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200"
              >
                Download PDF
              </a>
            ) : (
              <Link
                href="/account/payouts"
                className="px-2.5 py-1 rounded bg-slate-50 text-slate-600 font-semibold border border-slate-200"
              >
                Turn on self-invoicing
              </Link>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  From (Self-Invoiced Partner)
                </p>
                <p className="font-bold text-slate-900">{payout.partnerName}</p>
                <p className="text-slate-600">
                  {partner?.companyAddress || "Address not provided"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Billed To
                </p>
                <p className="font-bold text-slate-900">{issuerName}</p>
                <p className="text-slate-600">{issuerAddress}</p>
                {acct.taxId && (
                  <p className="text-slate-500 font-mono text-[11px]">
                    Tax / Reg ID: {acct.taxId}
                  </p>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm">
              <span>
                Settlement Period ({payout.periodFrom} → {payout.periodTo})
              </span>
              <span className="text-blue-700">
                {baseCurrency}{" "}
                {(payout.amountBase ?? payout.amount ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Bundled Rewards */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            Bundled Commission Rewards ({bundledRewards.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {bundledRewards.map((r) => (
              <div
                key={r.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <Link
                    href={`/rewards/${r.id}`}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {r.rewardNumber} · {r.fromActivity}
                  </Link>
                  <p className="text-slate-500">{r.fromRewardRule}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold">
                    {baseCurrency}{" "}
                    {(r.amountBase ?? r.amount ?? 0).toLocaleString()}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <CustomFieldsPanel objectType="Payouts" recordId={payout.id} stored={payout.customFieldsJson} />
    </div>
  );
}
