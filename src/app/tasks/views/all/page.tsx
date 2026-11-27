"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { currentIsoDateInTimezone } from "@/lib/prmEngine";
import { X } from "lucide-react";

export default function TasksListPage() {
  const { tasks, partners, manageItems, session, settings, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const acct = settings?.account_settings || {};
  const coworkers = manageItems.filter((m) => m.category === "team");
  const assigneeOptions = Array.from(
    new Set(
      [
        session?.name,
        acct.defaultOwnerName,
        ...coworkers.map((c) => c.name),
      ].filter(Boolean) as string[]
    )
  );

  const [form, setForm] = useState({
    name: "",
    dueDate: "",
    dueTime: "09:00 AM",
    type: "Follow-up",
    assignedTo: "",
    associationType: "Partner",
    associationName: "",
    description: "",
  });

  const openModal = () => {
    setForm({
      name: "",
      dueDate: currentIsoDateInTimezone(acct.timezone),
      dueTime: "09:00 AM",
      type: "Follow-up",
      assignedTo: session?.name || assigneeOptions[0] || "",
      associationType: "Partner",
      associationName: partners[0]?.name || "",
      description: "",
    });
    setModalOpen(true);
  };

  const filtered = tasks.filter((t) => {
    if (activeView !== "All" && t.status !== activeView) return false;
    if (
      search &&
      !`${t.name} ${t.associationName} ${t.assignedTo}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate("CREATE_TASK", form, `Task "${form.name}" created!`);
    setModalOpen(false);
  };

  return (
    <div>
      <EntityListToolbar
        title="Tasks"
        countLabel={`${filtered.length} tasks`}
        views={["All", "Overdue", "Due Today", "Upcoming", "Completed"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        dateFilterLabel="Due date"
        primaryActionLabel="New task"
        onPrimaryAction={openModal}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Done</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Due date</th>
                <th className="py-3 px-3 font-semibold">Description</th>
                <th className="py-3 px-3 font-semibold">Assigned to</th>
                <th className="py-3 px-3 font-semibold">Association</th>
                <th className="py-3 px-3 font-semibold">Created by</th>
                <th className="py-3 px-3 font-semibold">Completed by</th>
                <th className="py-3 px-4 font-semibold">Completed date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={t.status === "Completed"}
                      onChange={() =>
                        mutate(
                          "TOGGLE_TASK",
                          { id: t.id },
                          `Task "${t.name}" status updated`
                        )
                      }
                      className="rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td
                    className={`py-3 px-3 font-bold ${
                      t.status === "Completed"
                        ? "line-through text-slate-400"
                        : "text-slate-900"
                    }`}
                  >
                    <Link
                      href={`/tasks/${t.id}`}
                      className="hover:underline text-blue-700"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{t.type}</td>
                  <td className="py-3 px-3 text-slate-700">
                    {t.dueDate}
                    {t.dueTime ? ` · ${t.dueTime}` : ""}
                  </td>
                  <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                    {t.description}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {t.assignedTo || "Unassigned"}
                  </td>
                  <td className="py-3 px-3 font-medium text-blue-700">
                    {t.associationName
                      ? `${t.associationType}: ${t.associationName}`
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{t.createdBy}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {t.completedBy || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {t.completedDate || "—"}
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
              <h3 className="font-bold text-sm">New task</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Schedule partner onboarding review"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Time
                  </label>
                  <input
                    value={form.dueTime}
                    onChange={(e) =>
                      setForm({ ...form, dueTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Assigned to
                  </label>
                  <select
                    value={form.assignedTo}
                    onChange={(e) =>
                      setForm({ ...form, assignedTo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Association
                  </label>
                  <select
                    value={form.associationName}
                    onChange={(e) =>
                      setForm({ ...form, associationName: e.target.value })
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
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Task notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
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
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
