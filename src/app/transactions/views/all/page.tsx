"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar } from "@/components/SharedEngines";
import { useListControls } from "@/components/useListControls";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_LABELS,
  currentMonthKeyInTimezone,
  computeLast12Months,
} from "@/lib/prmEngine";
import { X } from "lucide-react";

export default function TransactionsListPage() {
  const { transactions, partners, customers, deals, settings, mutate } =
    usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];
  const currentMonthKey = currentMonthKeyInTimezone(acct.timezone);
  const currentQuarterKeys = computeLast12Months(acct.timezone).slice(-3);

  const [form, setForm] = useState({
    name: "",
    currency: "",
    amount: "",
    customerName: "",
    dealName: "",
    partnerName: "",
  });

  const openModal = () => {
    setForm({
      name: "",
      currency: baseCurrency,
      amount: "",
      customerName: customers[0]?.name || "",
      dealName: deals[0]?.name || "",
      partnerName: partners[0]?.name || "",
    });
    setModalOpen(true);
  };

  const viewRows = transactions.filter((t) => {
    if (activeView === "This Month" && t.monthKey !== currentMonthKey)
      return false;
    if (
      activeView === "This Quarter" &&
      !currentQuarterKeys.includes(t.monthKey)
    )
      return false;
    if (
      search &&
      !`${t.name} ${t.partnerName} ${t.customerName} ${t.dealName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const list = useListControls("transactions", viewRows, {
    dateField: "createdAt",
    dateLabel: "Creation date",
  });
  const filtered = list.pageRows;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_TRANSACTION",
      {
        ...form,
        currency: form.currency || baseCurrency,
      },
      `Transaction "${form.name}" recorded!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={list.filteredRows}
        controls={list}
        title="Transactions"
        countLabel={`${list.filteredCount} transactions`}
        views={["All", "This Month", "This Quarter"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add a new transaction"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold text-right">Amount</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Amount ({baseCurrency})
                </th>
                <th className="py-3 px-3 font-semibold">Partner</th>
                <th className="py-3 px-3 font-semibold">Customer</th>
                <th className="py-3 px-3 font-semibold">Deal</th>
                <th className="py-3 px-4 font-semibold">Creation date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link
                      href={`/transactions/${t.id}`}
                      className="hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right font-medium">
                    {t.currency} {t.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-blue-700">
                    {baseCurrency}{" "}
                    {(t.amountBase ?? t.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-medium text-blue-600">
                    {t.partnerName || "—"}
                  </td>
                  <td className="py-3 px-3 text-slate-800">
                    {t.customerName || "—"}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {t.dealName || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{t.monthKey}</td>
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
              <h3 className="font-bold text-sm">New transaction</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Invoice / Transaction reference *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="INV-0001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
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
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Customer
                </label>
                <select
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">None</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Deal
                </label>
                <select
                  value={form.dealName}
                  onChange={(e) =>
                    setForm({ ...form, dealName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">None</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Partner
                </label>
                <select
                  value={form.partnerName}
                  onChange={(e) =>
                    setForm({ ...form, partnerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">None</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
                Add Transaction
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
