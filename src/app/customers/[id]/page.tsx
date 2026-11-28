"use client";

import React from "react";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { customers, transactions, deals, settings } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  const customer = customers.find((c) => c.id === id);
  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/customers/views/all" label="Customers" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No customer record found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  const custTxs = transactions.filter((t) => t.customerName === customer.name);
  const sourceDeal = deals.find((d) => d.id === customer.sourceDealId);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb href="/customers/views/all" label="Customers" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">
              {customer.name}
            </h1>
            <StatusBadge status={customer.status} />
          </div>
        </div>
        <span className="font-extrabold text-base text-blue-700">
          Total Revenues: {baseCurrency}{" "}
          {(customer.revenuesBase || 0).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5 h-fit">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            About this customer
          </h3>
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-slate-500">Billing Email</span>
            <span className="font-medium text-blue-600">{customer.email}</span>
            <span className="text-slate-500">Source Partner</span>
            <span className="font-bold text-blue-700">
              {customer.sourcePartnerName || "—"}
            </span>
            <span className="text-slate-500">Source</span>
            <span className="font-medium">{customer.source}</span>
            <span className="text-slate-500">Became paying date</span>
            <span className="font-medium">
              {customer.becamePayingDate || "—"}
            </span>
            <span className="text-slate-500">External Billing ID</span>
            <span className="font-mono">{customer.bbid || "—"}</span>
            <span className="text-slate-500">Subscription Plan</span>
            <span className="font-semibold">
              {customer.subscriptionPlan || "—"}
            </span>
            <span className="text-slate-500">Billing Frequency</span>
            <span className="font-medium">
              {customer.billingFrequency} ({customer.billingPeriod})
            </span>
            <span className="text-slate-500">Source Deal</span>
            <span>
              {sourceDeal ? (
                <Link
                  href={`/deals/${sourceDeal.id}`}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  {sourceDeal.name}
                </Link>
              ) : (
                customer.sourceDealId || "—"
              )}
            </span>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            Customer Billing Transactions ({custTxs.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {custTxs.length === 0 ? (
              <p className="py-4 text-slate-400">
                No billing transactions recorded yet.
              </p>
            ) : (
              custTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="font-bold text-blue-700 hover:underline"
                    >
                      {tx.name}
                    </Link>
                    <p className="text-slate-500">
                      Period: {tx.monthKey} · Partner: {tx.partnerName || "—"}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900">
                    {tx.currency} {tx.amount.toLocaleString()} ({baseCurrency}{" "}
                    {(tx.amountBase ?? tx.amount ?? 0).toLocaleString()})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <CustomFieldsPanel objectType="Customers" recordId={customer.id} stored={customer.customFieldsJson} />
    </div>
  );
}
