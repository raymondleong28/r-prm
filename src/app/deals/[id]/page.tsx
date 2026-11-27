"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import {
  BackBreadcrumb,
  StatusBadge,
  NotesAndActivitiesTab,
  DEAL_STAGES_10,
} from "@/components/SharedEngines";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { UserCheck, RefreshCw, Plus, Trash2 } from "lucide-react";

const DEAL_TABS = [
  "Activities & Notes",
  "Partners",
  "Line items",
  "Transactions",
] as const;

export default function DealDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const {
    deals,
    partners,
    transactions,
    manageItems,
    settings,
    loading,
    mutate,
    showToast,
  } = usePrm();

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  // §1.4 & §3.5.1: Never fall back to deal-1 or deals[0]
  const deal = deals.find((d) => d.id === id);

  const [activeTab, setActiveTab] = useState<(typeof DEAL_TABS)[number]>(
    "Activities & Notes"
  );

  const productsCatalog = manageItems.filter((m) => m.category === "products");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading deal...</div>;
  }

  if (!deal) {
    return (
      <div className="max-w-xl mx-auto p-8 space-y-3">
        <BackBreadcrumb href="/deals/views/all" label="Deals" />
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Deal not found</p>
          <p className="text-xs text-slate-500 mt-1">
            No deal record exists with ID <code>{id || "(empty)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  const partnerObj = partners.find(
    (p) => p.id === deal.partnerId || p.name === deal.partnerName
  );
  const dealTransactions = transactions.filter((t) => t.dealName === deal.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lineItems: any[] = [];
  try {
    lineItems = JSON.parse(deal.lineItemsJson || "[]");
  } catch {
    lineItems = [];
  }

  const handleStageChange = async (newStage: string) => {
    await mutate(
      "UPDATE_DEAL_STAGE",
      { id: deal.id, stage: newStage },
      newStage === "Closed Won"
        ? "Deal marked Closed Won and evaluated against partner tier commission rules!"
        : `Deal stage updated to ${newStage}`
    );
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Number(itemQty) || 1);
    const unitPrice = Number(itemPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      showToast("Enter a unit price greater than zero.");
      return;
    }
    const prodLabel =
      selectedProduct ||
      productsCatalog[0]?.name ||
      "Professional Services Package";
    const nextItems = [
      ...lineItems,
      {
        id: `li-${Date.now()}`,
        product: prodLabel,
        qty,
        unitPrice,
        total: qty * unitPrice,
      },
    ];
    await mutate(
      "UPDATE_DEAL_LINE_ITEMS",
      { dealId: deal.id, lineItems: nextItems },
      `Added "${prodLabel}" to deal line items & recalculated total!`
    );
    setItemPrice("");
  };

  const handleRemoveLineItem = async (lineItemId: string) => {
    const nextItems = lineItems.filter((li) => li.id !== lineItemId);
    await mutate(
      "UPDATE_DEAL_LINE_ITEMS",
      { dealId: deal.id, lineItems: nextItems },
      "Removed line item and recalculated deal amount"
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/deals/views/all" label="Deals" />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{deal.name}</h1>
            <StatusBadge status={deal.status} />
            <span className="text-xs text-slate-500">
              Source:{" "}
              {partnerObj ? (
                <Link
                  href={`/partners/${partnerObj.id}`}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  {deal.partnerName}
                </Link>
              ) : (
                <span className="font-semibold text-slate-700">
                  {deal.partnerName || "—"}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <select
            value={deal.stage}
            onChange={(e) => handleStageChange(e.target.value)}
            className="px-3 py-2 border border-blue-300 rounded-lg text-xs font-bold text-blue-700 bg-blue-50"
          >
            {DEAL_STAGES_10.map((s) => (
              <option key={s} value={s}>
                Stage: {s}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              mutate(
                "ASSOCIATE_DEAL_CUSTOMER",
                { dealId: deal.id },
                `Associated paying customer record for "${deal.company}"!`
              )
            }
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Associate customer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              About this deal
            </h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-2">
              <span className="text-slate-500">Registered by</span>
              <span className="font-medium text-blue-700">
                {deal.partnerName || "—"}
              </span>

              <span className="text-slate-500">Owner</span>
              <span className="font-medium text-slate-900">
                {deal.owner || "—"}
              </span>

              <span className="text-slate-500">Stage</span>
              <span className="font-bold text-blue-700">{deal.stage}</span>

              <span className="text-slate-500">Program</span>
              <span className="font-medium text-slate-900">
                {deal.programName || "—"}
              </span>

              <span className="text-slate-500">Total Amount</span>
              <span className="font-bold text-slate-900">
                {deal.currency} {deal.amount.toLocaleString()}
              </span>

              <span className="text-slate-500">
                Total Amount ({baseCurrency})
              </span>
              <span className="font-extrabold text-blue-700">
                {baseCurrency} {Number(deal.amountBase || 0).toLocaleString()}
              </span>

              <span className="text-slate-500">Deal Type</span>
              <span className="font-medium text-slate-900">
                {deal.dealType || "—"}
              </span>

              <span className="text-slate-500">Subscription Plan</span>
              <span className="font-medium text-slate-900">
                {deal.subscriptionPlan || "—"}
              </span>

              <span className="text-slate-500">Expected close date</span>
              <span className="font-medium text-slate-900">
                {deal.closeDate || "—"}
              </span>

              <span className="text-slate-500">Date entered stage</span>
              <span className="font-medium text-slate-900">
                {deal.stageEnteredAt || "—"}
              </span>

              <span className="text-slate-500">Expiration date</span>
              <span className="font-medium text-slate-900">
                {deal.expirationDate || "—"}
              </span>

              <span className="text-slate-500">Contract start / end</span>
              <span className="font-medium text-slate-900">
                {deal.contractStart || "—"} → {deal.contractEnd || "—"}
              </span>

              <span className="text-slate-500">CRM Deal ID</span>
              <span className="font-medium text-slate-900">
                {deal.hubspotDealId || "—"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Client information
            </h3>
            <p className="font-bold text-slate-900">{deal.company}</p>
            <p className="text-slate-600">Primary Contact: {deal.clientName}</p>
            <p className="text-slate-500">
              Partner Representative: {deal.assignedContact || "—"}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                CRM sync
              </span>
              <button
                onClick={() => showToast("CRM deal sync logs checked")}
                className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>View logs</span>
              </button>
            </div>
            <p className="text-slate-500">
              Deal ID: {deal.hubspotDealId || "Not synced"}
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-1">
            {DEAL_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                  activeTab === t
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-xs">
            {activeTab === "Activities & Notes" && (
              <NotesAndActivitiesTab entityType="deal" entityId={deal.id} />
            )}

            {activeTab === "Partners" && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Associated Partners &amp; Attribution
                </h3>
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 flex items-center justify-between">
                  <div>
                    {partnerObj ? (
                      <Link
                        href={`/partners/${partnerObj.id}`}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {deal.partnerName}
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900">
                        {deal.partnerName || "—"}
                      </span>
                    )}
                    <p className="text-slate-500">
                      Role: Primary Sourced Partner · Contact:{" "}
                      {deal.assignedContact || "—"}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold">
                    100% Attribution
                  </span>
                </div>
              </div>
            )}

            {activeTab === "Line items" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-900">
                  Deal Product Line Items
                </h3>

                <form
                  onSubmit={handleAddLineItem}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
                >
                  <div className="flex-1 min-w-[200px]">
                    <label className="block font-medium text-slate-700 mb-1">
                      Product (from Manage &gt; Products catalog)
                    </label>
                    <select
                      value={selectedProduct || productsCatalog[0]?.name || ""}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {productsCatalog.map((prod) => (
                        <option key={prod.id} value={prod.name}>
                          {prod.name}
                        </option>
                      ))}
                      <option value="Professional Services Package">
                        Professional Services Package
                      </option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block font-medium text-slate-700 mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block font-medium text-slate-700 mb-1">
                      Unit Price ({deal.currency})
                    </label>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="Amount"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </form>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Product</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="py-2.5 font-semibold text-slate-900">
                          {li.product}
                        </td>
                        <td className="py-2.5 text-right">{li.qty}</td>
                        <td className="py-2.5 text-right">
                          {deal.currency} {Number(li.unitPrice).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right font-bold">
                          {deal.currency} {Number(li.total).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleRemoveLineItem(li.id)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "Transactions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Linked Billing Transactions ({dealTransactions.length})
                  </h3>
                  <button
                    onClick={() =>
                      mutate(
                        "CREATE_TRANSACTION",
                        {
                          name: `INV-${Math.floor(1000 + Math.random() * 9000)} · ${deal.company}`,
                          amount: deal.amount,
                          currency: deal.currency,
                          partnerName: deal.partnerName,
                          customerName: deal.company,
                          dealName: deal.name,
                        },
                        "Recorded new billing transaction for this deal!"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Record Transaction
                  </button>
                </div>
                {dealTransactions.length === 0 ? (
                  <p className="text-slate-500">
                    No billing transactions recorded for this deal yet.
                  </p>
                ) : (
                  dealTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{tx.name}</p>
                        <p className="text-slate-500">Period: {tx.monthKey}</p>
                      </div>
                      <span className="font-bold text-blue-700">
                        {baseCurrency}{" "}
                        {Number(tx.amountBase || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
