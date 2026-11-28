"use client";

import React, { useEffect, useState } from "react";
import { Copy } from "lucide-react";

type TokenView = {
  id: string;
  name: string;
  prefix: string;
  createdByEmail: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: "Active" | "Revoked";
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : "Never");

/** Create, list and revoke API tokens. The full token is shown once, right after creation. */
export function ApiTokensPanel({ origin, onToast }: { origin: string; onToast: (m: string) => void }) {
  const [tokens, setTokens] = useState<TokenView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/api-tokens", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setTokens(json.tokens || []);
      setLoadError(null);
    } else {
      setLoadError(json.error || `Couldn't load tokens (HTTP ${res.status})`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setCreated(json.token);
      setName("");
      onToast(`Token "${json.tokenInfo?.name}" created`);
      await load();
    } else {
      onToast(json.error || "Couldn't create token");
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/api-tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    setConfirmRevoke(null);
    if (res.ok) {
      onToast("Token revoked. Integrations using it stop working immediately.");
      await load();
    } else {
      onToast("Couldn't revoke token");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-slate-900">API access tokens</h3>
      <p className="text-slate-600">
        Use a token to call the R-PRM API from n8n, Zapier or your own scripts. Send it as{" "}
        <code className="px-1 rounded bg-slate-100">Authorization: Bearer &lt;token&gt;</code>. A token
        acts as the administrator who created it. Only a fingerprint is stored, so the full token is
        shown once.
      </p>
      <div className="p-3 rounded-lg bg-slate-900 text-blue-200 font-mono text-[11px] overflow-x-auto">
        {`curl -H "Authorization: Bearer <token>" ${origin || ""}/api/partners`}
      </div>

      {created && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
          <p className="font-bold">Copy your new token now. It won&rsquo;t be shown again.</p>
          <p className="font-mono bg-white px-3 py-1.5 rounded border border-emerald-200 break-all select-all">{created}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(created).then(() => onToast("Token copied"))}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-emerald-300 bg-white font-semibold"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
            <button type="button" onClick={() => setCreated(null)} className="px-2.5 py-1 rounded border border-slate-300 bg-white">
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. n8n deal sync)"
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
        />
        <button type="submit" disabled={busy} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-blue-300">
          + New token
        </button>
      </form>

      {loadError && <p className="p-2 rounded bg-red-50 border border-red-200 text-red-700">{loadError}</p>}
      {tokens === null && !loadError && <p className="text-slate-500">Loading tokens…</p>}
      {tokens && tokens.length === 0 && <p className="text-slate-500">No tokens yet.</p>}
      {tokens && tokens.length > 0 && (
        <div className="divide-y divide-slate-100">
          {tokens.map((t) => (
            <div key={t.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">
                  {t.name} <span className="font-mono font-normal text-slate-500">{t.prefix}…</span>
                </p>
                <p className="text-slate-500">
                  Created {fmt(t.createdAt)} by {t.createdByEmail} · Last used {fmt(t.lastUsedAt)}
                  {t.revokedAt ? ` · Revoked ${fmt(t.revokedAt)}` : ""}
                </p>
              </div>
              {t.status === "Active" ? (
                confirmRevoke === t.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-red-700 font-semibold">Revoke this token?</span>
                    <button disabled={busy} onClick={() => revoke(t.id)} className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold">
                      Revoke
                    </button>
                    <button onClick={() => setConfirmRevoke(null)} className="px-2.5 py-1 rounded border border-slate-300">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(t.id)}
                    className="px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                  >
                    Revoke
                  </button>
                )
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold text-[10px]">Revoked</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
