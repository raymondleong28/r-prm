"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import {
  SUPPORTED_CURRENCIES,
  currentIsoDateInTimezone,
} from "@/lib/prmEngine";
import { X } from "lucide-react";

export default function CustomersListPage() {
  const { customers, partners, deals, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const acct = settings?.account_settings || {};
  const baseCurrency = acct.mainCurrency || SUPPORTED_CURRENCIES[0];

  const [form, setForm] = useState({
    name: "",
    email: "",
    becamePayingDate: "",
    bbid: "",
    sourceDealId: "",
    subscriptionPlan: "",
    billingFrequency: "Yearly",
    billingPeriod: "12 Months",
    canceledDate: "",
    sourcePartnerName: "",
    source: "Deal Conversion",
    revenuesBase: "",
  });

  const openModal = () => {
    setForm({
      name: "",
      email: "",
      becamePayingDate: currentIsoDateInTimezone(acct.timezone),
      bbid: "",
      sourceDealId: "",
      subscriptionPlan: "",
      billingFrequency: "Yearly",
      billingPeriod: "12 Months",
      canceledDate: "",
      sourcePartnerName: partners[0]?.name || "",
      source: "Deal Conversion",
      revenuesBase: "",
    });
    setModalOpen(true);
  };

  const filtered = customers.filter((c) => {
    if (activeView === "Paying" && c.status !== "Paying") return false;
    if (
      search &&
      !`${c.name} ${c.email} ${c.sourcePartnerName}`
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
      "CREATE_CUSTOMER",
      form,
      `Customer "${form.name}" added!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        title="Customers"
        countLabel={`${filtered.length} customers`}
        views={["All", "Paying"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add a new customer"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Email</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Source</th>
                <th className="py-3 px-3 font-semibold">Source partner</th>
                <th className="py-3 px-3 font-semibold">Subscription Plan</th>
                <th className="py-3 px-3 font-semibold text-right">
                  Transactions
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  Revenues ({baseCurrency})
                </th>
                <th className="py-3 px-4 font-semibold">Became paying date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link href={`/customers/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-blue-600">{c.email}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-3 text-slate-600">{c.source}</td>
                  <td className="py-3 px-3 font-medium text-blue-700">
                    {c.sourcePartnerName || "—"}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {c.subscriptionPlan
                      ? `${c.subscriptionPlan} (${c.billingFrequency})`
                      : c.billingFrequency}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold">
                    {c.transactionsCount}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {baseCurrency} {(c.revenuesBase || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {c.becamePayingDate || "—"}
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
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add a new customer</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Acme Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="billing@acme.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Became paying date
                  </label>
                  <input
                    type="date"
                    value={form.becamePayingDate}
                    onChange={(e) =>
                      setForm({ ...form, becamePayingDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    External Billing ID
                  </label>
                  <input
                    value={form.bbid}
                    onChange={(e) => setForm({ ...form, bbid: e.target.value })}
                    placeholder="CUST-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Source Deal
                  </label>
                  <select
                    value={form.sourceDealId}
                    onChange={(e) =>
                      setForm({ ...form, sourceDealId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">None</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Subscription Plan
                  </label>
                  <input
                    value={form.subscriptionPlan}
                    onChange={(e) =>
                      setForm({ ...form, subscriptionPlan: e.target.value })
                    }
                    placeholder="Annual Plan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Billing Frequency
                  </label>
                  <select
                    value={form.billingFrequency}
                    onChange={(e) =>
                      setForm({ ...form, billingFrequency: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Yearly</option>
                    <option>Quarterly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Billing Period
                  </label>
                  <input
                    value={form.billingPeriod}
                    onChange={(e) =>
                      setForm({ ...form, billingPeriod: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Source partner
                  </label>
                  <select
                    value={form.sourcePartnerName}
                    onChange={(e) =>
                      setForm({ ...form, sourcePartnerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Source
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Deal Conversion</option>
                    <option>Inbound Referral Link</option>
                    <option>Partner Registration</option>
                  </select>
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
                Create Customer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
