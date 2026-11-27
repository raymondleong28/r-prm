"use client";

import React from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";

export default function TaskDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { tasks, mutate } = usePrm();

  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/tasks/views/all" label="Tasks" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No task found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb href="/tasks/views/all" label="Tasks" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{task.name}</h1>
            <StatusBadge status={task.status} />
          </div>
        </div>
        <button
          onClick={() =>
            mutate("TOGGLE_TASK", { id: task.id }, "Task completion toggled!")
          }
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
        >
          {task.status === "Completed" ? "Reopen Task" : "Mark Completed"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-y-2.5 max-w-lg">
          <span className="text-slate-500">Task Type</span>
          <span className="font-semibold">{task.type}</span>
          <span className="text-slate-500">Due Date &amp; Time</span>
          <span className="font-semibold">
            {task.dueDate} at {task.dueTime}
          </span>
          <span className="text-slate-500">Assigned To</span>
          <span className="font-semibold">{task.assignedTo}</span>
          <span className="text-slate-500">Association</span>
          <span className="font-bold text-blue-700">
            {task.associationType}: {task.associationName}
          </span>
          <span className="text-slate-500">Created By</span>
          <span>{task.createdBy}</span>
          <span className="text-slate-500">Completed By / Date</span>
          <span>
            {task.completedBy
              ? `${task.completedBy} on ${task.completedDate}`
              : "Not yet completed"}
          </span>
        </div>
        <div className="pt-3 border-t border-slate-100">
          <p className="text-slate-500 mb-1">Description</p>
          <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">
            {task.description}
          </p>
        </div>
      </div>
    </div>
  );
}
