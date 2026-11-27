"use client";

import React from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export default function BusinessPlanDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { businessPlans, settings } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const plan = businessPlans.find((bp) => bp.id === id);
  if (!plan) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/business-plans/views/all" label="Business Plans" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No business plan found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb
            href="/business-plans/views/all"
            label="Business Plans"
          />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{plan.name}</h1>
            <StatusBadge status={plan.status} />
          </div>
        </div>
        <span className="text-lg font-extrabold text-blue-700">
          Achieved: {plan.achievedPct}%
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-y-2 max-w-md">
          <span className="text-slate-500">Partner</span>
          <span className="font-bold text-blue-700">{plan.partnerName}</span>
          <span className="text-slate-500">Partner Owner</span>
          <span className="font-semibold">{plan.partnerOwner || "—"}</span>
          <span className="text-slate-500">Period</span>
          <span>
            {plan.startDate || "—"} → {plan.endDate || "—"}
          </span>
          <span className="text-slate-500">
            Target Revenue ({baseCurrency})
          </span>
          <span className="font-bold">
            {baseCurrency} {(plan.targetRevBase || 0).toLocaleString()}
          </span>
        </div>
        {plan.description && (
          <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            {plan.description}
          </p>
        )}
      </div>
    </div>
  );
}
