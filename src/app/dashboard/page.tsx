"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";
import { computeLast12Months, SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import {
  Plus,
  RotateCcw,
  X,
  Check,
  TrendingUp,
  Award,
  ExternalLink,
} from "lucide-react";

const WIDGET_CATALOG = [
  {
    category: "Deals",
    items: [
      { id: "latest_deals", name: "Latest deals", desc: "Latest deals registered by your partners" },
      { id: "deals_stats", name: "Deals", desc: "Deals statistics over the given time period" },
      { id: "monthly_revenues", name: "Monthly revenues", desc: "Monthly won deal revenue trend" },
      { id: "pending_deals", name: "Pending deals", desc: "Deals awaiting review and validation" },
      { id: "deals_funnel", name: "Deals funnel", desc: "Conversion rates across 10 pipeline stages" },
      { id: "deals_registered_count", name: "Number of deals registered", desc: "Volume of partner deal registrations" },
    ],
  },
  {
    category: "Leads",
    items: [
      { id: "leads_from_partners", name: "Leads from partners", desc: "Overview of leads registered by partners for the current month" },
      { id: "shared_leads", name: "Shared leads", desc: "Overview of leads shared to partners for the current month" },
      { id: "current_leads", name: "Current leads", desc: "List of leads you must follow" },
      { id: "pending_leads", name: "Pending leads", desc: "Leads awaiting acceptance" },
      { id: "submitted_leads_list", name: "Submitted leads (list)", desc: "Recent leads submitted by partners" },
      { id: "shared_leads_list", name: "Shared leads (list)", desc: "Recent leads shared to partners" },
      { id: "submitted_leads_stats", name: "Submitted leads (period stats)", desc: "Aggregate stats on partner-submitted leads" },
      { id: "shared_leads_stats", name: "Shared leads (period stats)", desc: "Aggregate stats on shared leads" },
    ],
  },
  {
    category: "Partners",
    items: [
      { id: "top_sales_partners", name: "Top sales partners", desc: "By number of won deals, total won amount and won rate" },
      { id: "new_partner_applications", name: "New partner applications", desc: "Recent applications awaiting onboarding review" },
      { id: "top_referral_partners", name: "Top referral partners", desc: "Partners ranked by submitted & converted leads" },
    ],
  },
  {
    category: "Rewards",
    items: [
      { id: "pending_rewards", name: "Pending rewards", desc: "List of all pending rewards requiring validation" },
      { id: "global_roi", name: "Global ROI", desc: "Ratio of partner-sourced revenue vs commissions paid" },
    ],
  },
  {
    category: "Transactions",
    items: [
      { id: "transactions_chart", name: "Transactions", desc: "Sum of transactions by partner over the last 12 months" },
      { id: "online_referrals", name: "Online referrals", desc: "Transactions generated via referral tracking links" },
    ],
  },
  {
    category: "Customers & Links",
    items: [
      { id: "top_links", name: "Top links", desc: "Highest performing partner referral links" },
      { id: "top_articles", name: "Top articles", desc: "Most viewed Partner Help Center guides" },
    ],
  },
];

const DEFAULT_WIDGETS = [
  "leads_from_partners",
  "shared_leads",
  "transactions_chart",
  "pending_rewards",
  "latest_deals",
  "current_leads",
  "top_sales_partners",
  "deals_stats",
];

export default function DashboardPage() {
  const {
    leads,
    deals,
    partners,
    rewards,
    transactions,
    trackingLinks,
    manageItems,
    settings,
    session,
    mutate,
    setGlobalModal,
  } = usePrm();

  const acct = settings?.account_settings || {};
  const workspaceName = acct.accountName || "Workspace";
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];
  const adminFirstName =
    (session?.name || "Administrator").split(" ")[0] || "Administrator";

  // §3.5.1: Compute the last 12 months dynamically from today in the workspace timezone
  const months12 = computeLast12Months(acct.timezone);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dealsPeriod, setDealsPeriod] = useState("All time");

  const activeWidgets: string[] = Array.isArray(settings.dashboard_widgets)
    ? settings.dashboard_widgets
    : DEFAULT_WIDGETS;

  const toggleWidget = async (id: string) => {
    const exists = activeWidgets.includes(id);
    const updated = exists
      ? activeWidgets.filter((w) => w !== id)
      : [...activeWidgets, id];
    await mutate(
      "SAVE_SETTING",
      { key: "dashboard_widgets", value: updated },
      exists ? "Widget removed from dashboard" : "Widget added to dashboard"
    );
  };

  const restoreDefaultWidgets = async () => {
    await mutate(
      "SAVE_SETTING",
      { key: "dashboard_widgets", value: DEFAULT_WIDGETS },
      "Dashboard restored to default widgets"
    );
  };

  // Compute live metrics
  const partnerSubmittedLeads = leads.filter((l) => l.source !== "Shared");
  const partnerAcceptedLeads = partnerSubmittedLeads.filter(
    (l) => l.status === "Accepted" || l.status === "Converted"
  );
  const partnerAcceptedPct =
    partnerSubmittedLeads.length > 0
      ? Math.round(
          (partnerAcceptedLeads.length / partnerSubmittedLeads.length) * 100
        )
      : 0;

  const sharedLeads = leads.filter((l) => l.source === "Shared");
  const sharedAcceptedLeads = sharedLeads.filter(
    (l) => l.status === "Accepted" || l.status === "Converted"
  );
  const sharedAcceptedPct =
    sharedLeads.length > 0
      ? Math.round((sharedAcceptedLeads.length / sharedLeads.length) * 100)
      : 0;

  const pendingRewards = rewards.filter((r) => r.status === "Pending");

  const wonDeals = deals.filter((d) => d.stage === "Closed Won");
  const lostDeals = deals.filter((d) => d.stage === "Closed Lost");
  const refusedDeals = deals.filter((d) => d.status === "Refused");
  const closingRate =
    deals.length > 0
      ? ((wonDeals.length / deals.length) * 100).toFixed(2)
      : "0.00";

  const totalSourcedBase = wonDeals.reduce(
    (sum, d) => sum + Number(d.amountBase || 0),
    0
  );
  const totalCommissionsBase = rewards
    .filter((r) => r.status !== "Refused" && Number(r.amountBase || 0) > 0)
    .reduce((sum, r) => sum + Number(r.amountBase || 0), 0);

  // Compute Top sales partners directly from live Closed Won deals
  const topSalesPartners = [...partners]
    .map((p) => {
      const pDeals = deals.filter(
        (d) => d.partnerName === p.name || d.partnerId === p.id
      );
      const pWon = pDeals.filter((d) => d.stage === "Closed Won");
      const wonAmountBase = pWon.reduce(
        (sum, d) => sum + Number(d.amountBase || 0),
        0
      );
      const winRate =
        pDeals.length > 0 ? Math.round((pWon.length / pDeals.length) * 100) : 0;
      return {
        ...p,
        computedWonCount: pWon.length,
        computedWonAmountBase: wonAmountBase,
        computedWinRate: winRate,
      };
    })
    .sort(
      (a, b) =>
        b.computedWonAmountBase - a.computedWonAmountBase ||
        b.computedWonCount - a.computedWonCount
    )
    .slice(0, 8);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {adminFirstName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {workspaceName} Overview · Base Currency: {baseCurrency}
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={restoreDefaultWidgets}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restore default</span>
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add widget</span>
          </button>
        </div>
      </div>

      {/* Top Row: Leads from partners & Shared leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.includes("leads_from_partners") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-sm text-slate-900">
                Leads from partners
              </h2>
              <Link
                href="/leads/views/all"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View all →
              </Link>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Overview of leads registered by partners for the current month
            </p>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                <p className="text-2xl font-extrabold text-blue-700">
                  {partnerSubmittedLeads.length}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">New leads</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-2xl font-extrabold text-slate-900">
                  {partnerAcceptedLeads.length}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Accepted leads</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <p className="text-2xl font-extrabold text-emerald-700">
                  {partnerAcceptedPct}%
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Accepted rate</p>
              </div>
            </div>
          </div>
        )}

        {activeWidgets.includes("shared_leads") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-sm text-slate-900">Shared leads</h2>
              <button
                onClick={() => setGlobalModal("share_lead")}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Share lead
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Overview of leads shared to partners for the current month
            </p>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                <p className="text-2xl font-extrabold text-blue-700">
                  {sharedLeads.length}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Shared leads</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-2xl font-extrabold text-slate-900">
                  {sharedAcceptedLeads.length}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Accepted leads</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <p className="text-2xl font-extrabold text-emerald-700">
                  {sharedAcceptedPct}%
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Accepted rate</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions 12-Month Bar Chart */}
      {activeWidgets.includes("transactions_chart") && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Transactions</h2>
              <p className="text-xs text-slate-500">
                Sum of transactions by partner over the last 12 months · Amount (
                {baseCurrency})
              </p>
            </div>
            <Link
              href="/transactions/views/all"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Open transactions →
            </Link>
          </div>

          <div className="mt-6 h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-200">
            {months12.map((m) => {
              const monthTxs = transactions.filter((t) => t.monthKey === m);
              const sum = monthTxs.reduce(
                (acc, t) => acc + Number(t.amountBase || 0),
                0
              );
              const maxBar = 32000;
              const pct = Math.min(100, Math.round((sum / maxBar) * 100));
              return (
                <div
                  key={m}
                  className="flex-1 flex flex-col items-center justify-end h-full group"
                >
                  <span className="text-[10px] font-semibold text-blue-700 mb-1">
                    {sum > 0
                      ? `${baseCurrency} ${(sum / 1000).toFixed(1)}K`
                      : "0"}
                  </span>
                  <div className="w-full max-w-[42px] bg-slate-100 rounded-t-md h-32 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${Math.max(pct, sum > 0 ? 14 : 3)}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        sum > 0
                          ? "bg-gradient-to-t from-blue-700 to-blue-500"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-2">{m}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Rewards Validation Table */}
      {activeWidgets.includes("pending_rewards") && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                Pending rewards ({pendingRewards.length})
              </h2>
              <p className="text-xs text-slate-500">
                List of all pending rewards requiring validation
              </p>
            </div>
            <Link
              href="/rewards/views/all"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Manage all rewards →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3 font-semibold">Reward #</th>
                  <th className="py-2.5 px-3 font-semibold">Partner</th>
                  <th className="py-2.5 px-3 font-semibold">From Activity</th>
                  <th className="py-2.5 px-3 font-semibold">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">
                    Amount ({baseCurrency})
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    Validation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRewards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No pending rewards awaiting validation.
                    </td>
                  </tr>
                ) : (
                  pendingRewards.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        {r.rewardNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {r.partnerName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.fromActivity}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {r.currency} {r.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {baseCurrency} {r.amountBase.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() =>
                            mutate(
                              "UPDATE_REWARD_STATUS",
                              { id: r.id, status: "Accepted" },
                              `Reward ${r.rewardNumber} validated!`
                            )
                          }
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px]"
                        >
                          Validate
                        </button>
                        <button
                          onClick={() =>
                            mutate(
                              "UPDATE_REWARD_STATUS",
                              { id: r.id, status: "Refused" },
                              `Reward ${r.rewardNumber} refused`
                            )
                          }
                          className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-600 text-[11px]"
                        >
                          Refuse
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Middle Grid: Latest deals & Current leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.includes("latest_deals") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Latest deals
                </h2>
                <p className="text-xs text-slate-500">
                  Latest deals registered by your partners
                </p>
              </div>
              <button
                onClick={() => setGlobalModal("register_deal")}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Register deal
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs flex-1">
              {deals.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  No deals registered yet.
                </p>
              ) : (
                deals.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/deals/${d.id}`}
                        className="font-semibold text-blue-700 hover:underline truncate block"
                      >
                        {d.name}
                      </Link>
                      <p className="text-slate-500 truncate">{d.partnerName}</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-bold text-slate-900">
                        {d.currency} {d.amount.toLocaleString()}
                      </span>
                      <StatusBadge status={d.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeWidgets.includes("current_leads") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="font-bold text-sm text-slate-900">
                    Current leads
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 rounded-full">
                    {leads.length} leads
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  List of leads you must follow
                </p>
              </div>
              <button
                onClick={() => setGlobalModal("submit_lead")}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Submit lead
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs flex-1">
              {leads.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  No leads submitted yet.
                </p>
              ) : (
                leads.slice(0, 8).map((l) => (
                  <div
                    key={l.id}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${l.id}`}
                        className="font-semibold text-blue-700 hover:underline block truncate"
                      >
                        {l.firstName} {l.lastName} · {l.company}
                      </Link>
                      <p className="text-slate-500 truncate">
                        {l.sourcePartnerName} · Assigned {l.assignedDate}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Grid: Top sales partners & Deals statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.includes("top_sales_partners") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Top sales partners
                </h2>
                <p className="text-xs text-slate-500">
                  By number of won deals, total won amount and won rate
                </p>
              </div>
              <Link
                href="/partners/views/all"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                All partners →
              </Link>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {topSalesPartners.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  No partners added yet.
                </p>
              ) : (
                topSalesPartners.map((p, idx) => (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <Link
                        href={`/partners/${p.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-700"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-500">
                        {p.computedWonCount} won deals ({p.computedWinRate}% win
                        rate)
                      </span>
                      <span className="font-bold text-blue-700">
                        {baseCurrency}{" "}
                        {p.computedWonAmountBase.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeWidgets.includes("deals_stats") && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Deals</h2>
                <p className="text-xs text-slate-500">
                  Deals statistics over the given time period
                </p>
              </div>
              <select
                value={dealsPeriod}
                onChange={(e) => setDealsPeriod(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                <option>All time</option>
                <option>Last 12 months</option>
                <option>This quarter</option>
                <option>This month</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-500">Registered deals</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {deals.length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-500">Deal refused</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {refusedDeals.length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-500">Assigned deals</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {deals.filter((d) => Boolean(d.assignedContact)).length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <p className="text-emerald-800 font-medium">Won deals</p>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                  {wonDeals.length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                <p className="text-amber-800 font-medium">Lost deals</p>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">
                  {lostDeals.length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-blue-800 font-medium">Deal closing rate</p>
                <p className="text-2xl font-extrabold text-blue-700 mt-1">
                  {closingRate}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optional Extra Enabled Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeWidgets.includes("global_roi") && (
          <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Global Partner ROI</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Sourced Revenue vs Commission Rewards
            </p>
            <p className="text-3xl font-extrabold text-slate-900">
              {totalCommissionsBase > 0
                ? `${(totalSourcedBase / totalCommissionsBase).toFixed(1)}x ROI`
                : "0.0x ROI"}
            </p>
            <p className="text-xs text-emerald-700 mt-1 font-medium">
              {baseCurrency} {totalSourcedBase.toLocaleString()} Sourced ·{" "}
              {baseCurrency} {totalCommissionsBase.toLocaleString()} Commissions
            </p>
          </div>
        )}

        {activeWidgets.includes("top_links") && (
          <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm mb-2">
              <ExternalLink className="w-4 h-4" />
              <span>Top Referral Links</span>
            </div>
            <div className="space-y-2 text-xs">
              {trackingLinks.length === 0 ? (
                <p className="text-slate-400">No tracking links yet.</p>
              ) : (
                trackingLinks.map((lnk) => (
                  <div key={lnk.id} className="flex justify-between">
                    <span className="truncate font-medium text-slate-800">
                      {lnk.name}
                    </span>
                    <span className="font-bold text-blue-700">
                      {lnk.uniqueVisitors} visits
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeWidgets.includes("top_articles") && (
          <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm mb-2">
              <Award className="w-4 h-4" />
              <span>Top Help Center Articles</span>
            </div>
            <div className="space-y-2 text-xs">
              {manageItems.filter((m) => m.category === "help_articles")
                .length === 0 ? (
                <p className="text-slate-400">No help articles published yet.</p>
              ) : (
                manageItems
                  .filter((m) => m.category === "help_articles")
                  .map((a) => (
                    <div
                      key={a.id}
                      className="truncate text-slate-700 font-medium"
                    >
                      • {a.name}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Widget Slide-Over Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
            <div className="p-5 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add widget to Dashboard</h3>
                <p className="text-xs text-blue-100">
                  Toggle widgets across all PRM analytics categories
                </p>
              </div>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {WIDGET_CATALOG.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    {cat.category}
                  </h4>
                  <div className="space-y-2">
                    {cat.items.map((w) => {
                      const enabled = activeWidgets.includes(w.id);
                      return (
                        <div
                          key={w.id}
                          onClick={() => toggleWidget(w.id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                            enabled
                              ? "border-blue-600 bg-blue-50/60"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {w.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {w.desc}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 ${
                              enabled
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {enabled ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
