"use client";

import React, { useState } from "react";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import {
  BackBreadcrumb,
  StatusBadge,
  NotesAndActivitiesTab,
} from "@/components/SharedEngines";
import { RecordActivityLog } from "@/components/RecordActivityLog";
import { LeadConvertModal } from "@/components/LeadConvertModal";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";
import { ArrowRightCircle, RefreshCw } from "lucide-react";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { leads, partners, settings, loading, mutate, showToast } = usePrm();
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  const baseCurrency =
    settings?.account_settings?.mainCurrency || SUPPORTED_CURRENCIES[0];

  // §1.4 & §3.5.1: Never fall back to lead-1 or leads[0]
  const lead = leads.find((l) => l.id === id);

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading lead...</div>;
  }

  if (!lead) {
    return (
      <div className="max-w-xl mx-auto p-8 space-y-3">
        <BackBreadcrumb href="/leads/views/all" label="Leads" />
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Lead not found</p>
          <p className="text-xs text-slate-500 mt-1">
            No lead record exists with ID <code>{id || "(empty)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  const partnerObj = partners.find(
    (p) => p.id === lead.sourcePartnerId || p.name === lead.sourcePartnerName
  );

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/leads/views/all" label="Leads" />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <StatusBadge status={lead.status} />
            <span className="text-xs text-slate-500">
              Source:{" "}
              {partnerObj ? (
                <Link
                  href={`/partners/${partnerObj.id}`}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  {lead.sourcePartnerName}
                </Link>
              ) : (
                <span className="font-semibold text-slate-700">
                  {lead.sourcePartnerName || "—"}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {lead.status === "Pending" && (
            <>
              <button
                onClick={() =>
                  mutate(
                    "UPDATE_LEAD_STATUS",
                    { id: lead.id, status: "Accepted" },
                    "Lead accepted!"
                  )
                }
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Accept Lead
              </button>
              <button
                onClick={() =>
                  mutate(
                    "UPDATE_LEAD_STATUS",
                    { id: lead.id, status: "Refused" },
                    "Lead refused"
                  )
                }
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
              >
                Refuse
              </button>
            </>
          )}
          <button
            onClick={() => setConvertModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>Convert to deal</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              About this lead
            </h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-2">
              <span className="text-slate-500">Submitted by</span>
              <span className="font-medium text-blue-700">
                {lead.sourcePartnerName || "—"}
              </span>

              <span className="text-slate-500">Owner</span>
              <span className="font-medium text-slate-900">
                {lead.owner || "—"}
              </span>

              <span className="text-slate-500">Assigned partner</span>
              <span className="font-medium text-slate-900">
                {lead.assignedPartner || "—"}
              </span>

              <span className="text-slate-500">Assigned contact</span>
              <span className="font-medium text-slate-900">
                {lead.assignedContact || "—"}
              </span>

              <span className="text-slate-500">Assigned date</span>
              <span className="font-medium text-slate-900">
                {lead.assignedDate || "—"}
              </span>

              <span className="text-slate-500">Accepted by</span>
              <span className="font-medium text-slate-900">
                {lead.acceptedBy || "—"}
              </span>

              <span className="text-slate-500">Accepted date</span>
              <span className="font-medium text-slate-900">
                {lead.acceptedDate || "—"}
              </span>

              <span className="text-slate-500">Company Name</span>
              <span className="font-bold text-slate-900">{lead.company}</span>

              <span className="text-slate-500">Job title</span>
              <span className="font-medium text-slate-900">
                {lead.jobTitle || "—"}
              </span>

              <span className="text-slate-500">Email</span>
              <span className="font-medium text-blue-600 truncate">
                {lead.email}
              </span>

              <span className="text-slate-500">Mobile number</span>
              <span className="font-medium text-slate-900">
                {lead.phone || "—"}
              </span>

              <span className="text-slate-500">Country</span>
              <span className="font-medium text-slate-900">
                {lead.country || "—"}
              </span>

              <span className="text-slate-500">Retail brand name</span>
              <span className="font-medium text-slate-900">
                {lead.retailBrand || lead.company}
              </span>

              <span className="text-slate-500">Number of outlets</span>
              <span className="font-bold text-slate-900">
                {lead.outletsCount}
              </span>

              <span className="text-slate-500">POS Solution</span>
              <span className="font-medium text-slate-900">
                {lead.posSolution || "—"}
              </span>

              <span className="text-slate-500">Deadline</span>
              <span className="font-medium text-slate-900">
                {lead.deadline || "—"}
              </span>
            </div>

            {lead.remarks && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 mb-1">
                  Feature Requirements / Remark:
                </p>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {lead.remarks}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">
                CRM sync
              </span>
              <RecordActivityLog objectId={lead.id} />
            </div>
            <p className="text-slate-500">
              Last sync: {lead.hubspotSyncedAt || "Not synced"}
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <NotesAndActivitiesTab entityType="lead" entityId={lead.id} />
        </div>
      </div>

      <LeadConvertModal
        lead={convertModalOpen ? lead : null}
        defaultCurrency={baseCurrency}
        onClose={() => setConvertModalOpen(false)}
        onSubmit={async (payload) => {
          const res = await mutate(
            "CONVERT_LEAD_TO_DEAL",
            payload,
            `Converted "${lead.firstName} ${lead.lastName}" to Deal!`
          );
          if (res?.deal?.id) {
            router.push(`/deals/${res.deal.id}`);
          }
        }}
      />
      <CustomFieldsPanel objectType="Leads" recordId={lead.id} stored={lead.customFieldsJson} />
    </div>
  );
}
