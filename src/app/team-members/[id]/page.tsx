"use client";

import React from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import { Send } from "lucide-react";

export default function TeamMemberDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { teamMembers, settings, mutate } = usePrm();

  const workspaceName =
    settings?.account_settings?.accountName || "Workspace";

  const member = teamMembers.find((m) => m.id === id);
  if (!member) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-3 text-xs">
        <BackBreadcrumb href="/team-members/views/all" label="Team members" />
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <p className="font-bold text-sm text-slate-900">
            Lookup Status: not_found
          </p>
          <p className="text-slate-500">
            No partner team member found with ID &quot;{id}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <BackBreadcrumb href="/team-members/views/all" label="Team members" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{member.name}</h1>
            <StatusBadge status={member.status} />
          </div>
        </div>
        <button
          onClick={() =>
            mutate(
              "SEND_EMAIL",
              {
                to: member.email,
                subject: `Activate your {{workspace.name}} Partner Portal (${member.partnerName})`,
                body: `Hi ${member.name},\n\nClick your fresh time-limited activation link below to sign into the ${workspaceName} Partner Portal for ${member.partnerName}.`,
                templateName: "Partner Activation Link",
                portalLink: "/p",
              },
              `Sent fresh time-limited activation link to ${member.email}!`
            )
          }
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Time-Limited Activation Link</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2.5">
        <div className="grid grid-cols-2 gap-y-2 max-w-md">
          <span className="text-slate-500">Partner Organization</span>
          <span className="font-bold text-blue-700">{member.partnerName}</span>
          <span className="text-slate-500">Email</span>
          <span className="font-medium text-blue-600">{member.email}</span>
          <span className="text-slate-500">Job Title</span>
          <span className="font-medium">{member.jobTitle || "—"}</span>
          <span className="text-slate-500">Phone</span>
          <span className="font-medium">{member.phone || "—"}</span>
          <span className="text-slate-500">Portal Role</span>
          <span className="font-bold">{member.role}</span>
          <span className="text-slate-500">Invited At</span>
          <span>{member.invitedAt || "—"}</span>
        </div>
      </div>
    </div>
  );
}
