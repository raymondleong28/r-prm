"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

export interface PrmState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamMembers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deals: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rewards: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payouts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessPlans: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accounts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collaborations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSources: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackingLinks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manageItems: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLogs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any | null;
}

interface PrmContextValue extends PrmState {
  loading: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
  refresh: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload?: any, successMessage?: string) => Promise<any>;
  globalModal: "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null;
  setGlobalModal: (m: "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null) => void;
}

const emptyState: PrmState = {
  programs: [],
  partners: [],
  teamMembers: [],
  leads: [],
  deals: [],
  customers: [],
  transactions: [],
  rewards: [],
  payouts: [],
  tasks: [],
  businessPlans: [],
  accounts: [],
  collaborations: [],
  dataSources: [],
  trackingLinks: [],
  manageItems: [],
  notes: [],
  settings: {},
  auditLogs: [],
  session: null,
};

const PrmContext = createContext<PrmContextValue>({
  ...emptyState,
  loading: true,
  toast: null,
  showToast: () => {},
  refresh: async () => {},
  mutate: async () => {},
  globalModal: null,
  setGlobalModal: () => {},
});

// Map mutation action names to per-object endpoints (§13.7 Slice 1: /api/prm retired)
function getEndpointForAction(action: string): string {
  if (action.includes("PARTNER") && !action.includes("GROUP")) return "/api/partners";
  if (action.includes("TEAM")) return "/api/team-members";
  if (action.includes("LEAD")) return "/api/leads";
  if (action.includes("DEAL")) return "/api/deals";
  if (action.includes("CUSTOMER")) return "/api/customers";
  if (action.includes("TRANSACTION")) return "/api/transactions";
  if (action.includes("REWARD")) return "/api/rewards";
  if (action.includes("PAYOUT")) return "/api/payouts";
  if (action.includes("TASK")) return "/api/tasks";
  if (action.includes("BUSINESS_PLAN")) return "/api/business-plans";
  if (action.includes("PROGRAM")) return "/api/programs";
  if (action.includes("LINK")) return "/api/tracking-links";
  if (action.includes("ACCOUNT")) return "/api/accounts";
  if (action.includes("COLLABORATION")) return "/api/collaborations";
  if (action.includes("DATA_SOURCE")) return "/api/data-sources";
  if (action.includes("NOTE")) return "/api/notes";
  if (action.includes("SETTING")) return "/api/settings";
  return "/api/manage-items";
}

export function PrmProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<PrmState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [globalModal, setGlobalModal] = useState<
    "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null
  >(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const refresh = useCallback(async () => {
    // Skip authenticated resource fetch on public login, setup, or public intake form routes
    if (
      pathname === "/setup" ||
      pathname.startsWith("/setup/") ||
      pathname === "/login" ||
      pathname === "/p/login" ||
      pathname === "/p/activate" ||
      pathname.startsWith("/forms/")
    ) {
      setLoading(false);
      return;
    }

    try {
      const authRes = await fetch("/api/auth", { cache: "no-store" });
      if (!authRes.ok) {
        const authErrJson = await authRes.json().catch(() => ({}));
        if (authErrJson?.needsSetup && typeof window !== "undefined") {
          window.location.href = "/setup";
          return;
        }
        setLoading(false);
        return;
      }
      const authJson = await authRes.json();
      if (authJson?.needsSetup && typeof window !== "undefined") {
        window.location.href = "/setup";
        return;
      }
      const session = authJson.session;
      const isPartner = session?.identityType === "partner";

      // Fetch from per-resource endpoints (§13.7 Slice 1: /api/prm retired)
      const fetchList = async (url: string) => {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return [];
        const j = await r.json();
        return j.data ?? [];
      };

      const [
        programs,
        partners,
        teamMembers,
        leads,
        deals,
        customers,
        transactions,
        rewards,
        payouts,
        tasks,
        businessPlans,
        accounts,
        collaborations,
        dataSources,
        trackingLinks,
        manageItems,
        notes,
        settingsRes,
        auditLogs,
      ] = await Promise.all([
        fetchList("/api/programs"),
        fetchList("/api/partners"),
        fetchList("/api/team-members"),
        fetchList("/api/leads"),
        fetchList("/api/deals"),
        fetchList("/api/customers"),
        fetchList("/api/transactions"),
        fetchList("/api/rewards"),
        fetchList("/api/payouts"),
        isPartner ? Promise.resolve([]) : fetchList("/api/tasks"),
        fetchList("/api/business-plans"),
        isPartner ? Promise.resolve([]) : fetchList("/api/accounts"),
        fetchList("/api/collaborations"),
        isPartner ? Promise.resolve([]) : fetchList("/api/data-sources"),
        fetchList("/api/tracking-links"),
        fetchList("/api/manage-items"),
        fetchList("/api/notes"),
        fetch("/api/settings", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : { data: {} }
        ),
        isPartner ? Promise.resolve([]) : fetchList("/api/audit"),
      ]);

      setData({
        programs,
        partners,
        teamMembers,
        leads,
        deals,
        customers,
        transactions,
        rewards,
        payouts,
        tasks,
        businessPlans,
        accounts,
        collaborations,
        dataSources,
        trackingLinks,
        manageItems,
        notes,
        settings: settingsRes.data || {},
        auditLogs,
        session,
      });
    } catch (e) {
      console.error("Failed to fetch per-resource PRM data", e);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mutate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (action: string, payload: any = {}, successMessage?: string) => {
      const endpoint = getEndpointForAction(action);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      await refresh();
      if (successMessage && res.ok) {
        showToast(successMessage);
      } else if (!res.ok && json.error) {
        showToast(`Error: ${json.error}`);
      }
      return json;
    },
    [refresh, showToast]
  );

  return (
    <PrmContext.Provider
      value={{
        ...data,
        loading,
        toast,
        showToast,
        refresh,
        mutate,
        globalModal,
        setGlobalModal,
      }}
    >
      {children}
    </PrmContext.Provider>
  );
}

export function usePrm() {
  return useContext(PrmContext);
}
