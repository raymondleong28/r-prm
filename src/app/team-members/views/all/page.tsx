"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { X, Trash2, UserCheck } from "lucide-react";

export default function PartnerTeamMembersPage() {
  const { teamMembers, partners, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState("Manager");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    phone: "",
    linkedIn: "",
    partnerName: "",
    role: "Sales Rep",
    portalAccess: true,
  });

  const openModal = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      jobTitle: "",
      phone: "",
      linkedIn: "",
      partnerName: partners[0]?.name || "",
      role: "Sales Rep",
      portalAccess: true,
    });
    setModalOpen(true);
  };

  const filtered = teamMembers.filter((m) => {
    if (activeView !== "All" && m.status !== activeView) return false;
    if (
      search &&
      !`${m.name} ${m.email} ${m.partnerName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_TEAM_MEMBER",
      {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim(),
      },
      `Partner team member ${form.firstName} ${form.lastName} added!`
    );
    setModalOpen(false);
  };

  const handleBulkAction = async (
    bulkAction: "delete" | "set_main_contact" | "update_role"
  ) => {
    await mutate(
      "BULK_TEAM_MEMBERS",
      { memberIds: selectedIds, bulkAction, role: bulkRole },
      `Executed "${bulkAction}" on ${selectedIds.length} member(s)`
    );
    setSelectedIds([]);
  };

  return (
    <div>
      <EntityListToolbar
        title="Team members"
        countLabel={`${filtered.length} members`}
        views={["All", "Pending", "Sent", "Expired"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Add new team member"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-3">
        {selectedIds.length > 0 && (
          <div className="p-3 rounded-xl bg-blue-600 text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow">
            <span className="font-bold">
              {selectedIds.length} team member(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkAction("set_main_contact")}
                className="px-3 py-1.5 rounded-lg bg-white text-blue-700 font-semibold flex items-center space-x-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Change main contact</span>
              </button>
              <div className="flex items-center space-x-1">
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-slate-900 font-semibold"
                >
                  <option>Manager</option>
                  <option>Sales Rep</option>
                  <option>Stakeholder</option>
                </select>
                <button
                  onClick={() => handleBulkAction("update_role")}
                  className="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold"
                >
                  Update Role
                </button>
              </div>
              <button
                onClick={() => handleBulkAction("delete")}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? filtered.map((m) => m.id) : []
                      )
                    }
                  />
                </th>
                <th className="py-3 px-3 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Email</th>
                <th className="py-3 px-3 font-semibold">Partner</th>
                <th className="py-3 px-3 font-semibold">Job title</th>
                <th className="py-3 px-3 font-semibold">Portal Role</th>
                <th className="py-3 px-3 font-semibold">Invitation Status</th>
                <th className="py-3 px-4 font-semibold">Invited date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-blue-50/30">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleSelect(m.id)}
                    />
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-700">
                    <Link
                      href={`/team-members/${m.id}`}
                      className="hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-blue-600">{m.email}</td>
                  <td className="py-3 px-3 font-medium text-slate-800">
                    {m.partnerName}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {m.jobTitle || "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {m.invitedAt || "—"}
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
              <h3 className="font-bold text-sm">Add new team member</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Partner organization *
                </label>
                <select
                  required
                  value={form.partnerName}
                  onChange={(e) =>
                    setForm({ ...form, partnerName: e.target.value })
                  }
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    First name *
                  </label>
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    placeholder="Jane"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Last name *
                  </label>
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    placeholder="Doe"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="jane@acme.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+1 555 0100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={form.jobTitle}
                    onChange={(e) =>
                      setForm({ ...form, jobTitle: e.target.value })
                    }
                    placeholder="Account Executive"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Portal Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Manager</option>
                    <option>Sales Rep</option>
                    <option>Stakeholder</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  value={form.linkedIn}
                  onChange={(e) =>
                    setForm({ ...form, linkedIn: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/profile"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  checked={form.portalAccess}
                  onChange={(e) =>
                    setForm({ ...form, portalAccess: e.target.checked })
                  }
                />
                <span className="font-semibold text-slate-800">
                  This contact has access to the partner portal
                </span>
              </label>
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
                Save Team Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
