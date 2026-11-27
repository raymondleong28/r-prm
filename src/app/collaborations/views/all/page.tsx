"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { X } from "lucide-react";

export default function CollaborationsListPage() {
  const { collaborations, partners, accounts, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    partnerName: "",
    assignedContact: "",
    accountName: "",
  });

  const openModal = () => {
    const firstPartner = partners[0];
    setForm({
      name: "",
      partnerName: firstPartner?.name || "",
      assignedContact: firstPartner
        ? `${firstPartner.contactFirstName} ${firstPartner.contactLastName}`.trim()
        : "",
      accountName: accounts[0]?.accountName || "",
    });
    setModalOpen(true);
  };

  const filtered = collaborations.filter((c) => {
    if (activeView === "New Collaborations" && c.status !== "New") return false;
    if (activeView === "Accepted" && c.status !== "Accepted") return false;
    if (activeView === "Closed" && c.status !== "Closed") return false;
    if (
      search &&
      !`${c.name} ${c.partnerName} ${c.accountName}`
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
      "CREATE_COLLABORATION",
      form,
      `Co-selling collaboration "${form.name}" launched!`
    );
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        exportRows={filtered}
        title="Collaborations"
        countLabel={`${filtered.length} collaborations`}
        views={["All", "New Collaborations", "Accepted", "Closed"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="New collaboration"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Collaboration name</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Owner</th>
                <th className="py-3 px-3 font-semibold">Partner</th>
                <th className="py-3 px-3 font-semibold">Assigned contact</th>
                <th className="py-3 px-3 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold">Last activity date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-blue-700">
                    <Link
                      href={`/collaborations/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-3 text-slate-700">{c.owner || "—"}</td>
                  <td className="py-3 px-3 font-medium text-blue-700">
                    {c.partnerName}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {c.assignedContact || "—"}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {c.accountName}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {c.lastActivityDate}
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
              <h3 className="font-bold text-sm">New co-selling collaboration</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Collaboration name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Executive Intro & Joint Demo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Partner *
                </label>
                <select
                  required
                  value={form.partnerName}
                  onChange={(e) => {
                    const p = partners.find(
                      (pt) => pt.name === e.target.value
                    );
                    setForm({
                      ...form,
                      partnerName: e.target.value,
                      assignedContact: p
                        ? `${p.contactFirstName} ${p.contactLastName}`.trim()
                        : form.assignedContact,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select partner...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target Account *
                </label>
                {accounts.length > 0 ? (
                  <select
                    required
                    value={form.accountName}
                    onChange={(e) =>
                      setForm({ ...form, accountName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.accountName}>
                        {a.accountName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={form.accountName}
                    onChange={(e) =>
                      setForm({ ...form, accountName: e.target.value })
                    }
                    placeholder="Acme Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                )}
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
                Start Collaboration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
