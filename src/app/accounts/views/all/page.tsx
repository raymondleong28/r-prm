"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { useListControls } from "@/components/useListControls";
import { X } from "lucide-react";

export default function AccountsMappingListPage() {
  const { accounts, partners, session, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    accountName: "",
    type: "Prospect",
    ownerName: "",
    partnerName: "",
    partnerAccountType: "Customer",
  });

  const openModal = () => {
    setForm({
      accountName: "",
      type: "Prospect",
      ownerName: session?.name || "",
      partnerName: partners[0]?.name || "",
      partnerAccountType: "Customer",
    });
    setModalOpen(true);
  };

  const viewRows = accounts.filter((a) => {
    if (activeView === "All Overlaps" && !a.hasOverlap) return false;
    if (
      activeView === "Prospects vs Partner Customers" &&
      !(a.type === "Prospect" && a.partnerAccountType === "Customer")
    )
      return false;
    if (
      activeView === "Customers vs Partner Prospects" &&
      !(a.type === "Customer" && a.partnerAccountType === "Prospect")
    )
      return false;
    if (
      search &&
      !`${a.accountName} ${a.partnerName} ${a.ownerName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const list = useListControls("accounts", viewRows, {
    dateField: "createdAt",
    dateLabel: "Creation date",
  });
  const filtered = list.pageRows;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_ACCOUNT_RECORD",
      form,
      `Mapped account "${form.accountName}" added!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={list.filteredRows}
        controls={list}
        title="Accounts"
        countLabel={`${list.filteredCount} accounts`}
        views={[
          "All",
          "All Overlaps",
          "Prospects vs Partner Customers",
          "Customers vs Partner Prospects",
        ]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add mapped account"
        onPrimaryAction={openModal}
        extraRightControls={
          <Link
            href="/data-sources"
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            Manage data sources
          </Link>
        }
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Account name</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Owner name</th>
                <th className="py-3 px-3 font-semibold">Owner email</th>
                <th className="py-3 px-3 font-semibold">Source</th>
                <th className="py-3 px-3 font-semibold">Imported date</th>
                <th className="py-3 px-3 font-semibold text-center">
                  Partner customers
                </th>
                <th className="py-3 px-3 font-semibold text-center">
                  Partner opportunities
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Partner prospects
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link href={`/accounts/${a.id}`} className="hover:underline">
                      {a.accountName}
                    </Link>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={a.type} />
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {a.ownerName || "—"}
                  </td>
                  <td className="py-3 px-3 text-blue-600">
                    {a.ownerEmail || "—"}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{a.source}</td>
                  <td className="py-3 px-3 text-slate-500">{a.importedDate}</td>
                  <td className="py-3 px-3 text-center font-bold text-blue-700">
                    {a.partnerAccountType === "Customer"
                      ? a.partnerName || "—"
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-blue-700">
                    {a.partnerAccountType === "Opportunity"
                      ? a.partnerName || "—"
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-blue-700">
                    {a.partnerAccountType === "Prospect"
                      ? a.partnerName || "—"
                      : "—"}
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
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add mapped account</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Account name *
                </label>
                <input
                  required
                  value={form.accountName}
                  onChange={(e) =>
                    setForm({ ...form, accountName: e.target.value })
                  }
                  placeholder="Acme Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Your Account Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Prospect</option>
                    <option>Opportunity</option>
                    <option>Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Partner Account Type
                  </label>
                  <select
                    value={form.partnerAccountType}
                    onChange={(e) =>
                      setForm({ ...form, partnerAccountType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Customer</option>
                    <option>Opportunity</option>
                    <option>Prospect</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Overlapping Partner
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
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
