"use client";

import React, { useState } from "react";
import { Copy, KeyRound, ShieldCheck } from "lucide-react";

export type MfaEnrollmentView = {
  otpauthUri: string;
  setupKey: string;
  qrDataUrl: string;
  issuer: string;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => setCopied(false));
      }}
      className="inline-flex items-center space-x-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold"
    >
      <Copy className="w-3 h-3" />
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

/** Step-by-step authenticator setup: scan the QR code or type the setup key. */
export function MfaSetupPanel({ enrollment }: { enrollment: MfaEnrollmentView }) {
  return (
    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3 text-[11px] text-slate-800">
      <p className="font-bold text-blue-900 flex items-center space-x-1.5">
        <ShieldCheck className="w-4 h-4" />
        <span>Set up two-step login</span>
      </p>
      <ol className="list-decimal pl-4 space-y-1">
        <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password or Apple Passwords).</li>
        <li>Scan this QR code, or choose &ldquo;Enter a setup key&rdquo; and type the key below.</li>
        <li>Enter the 6-digit code the app shows and sign in.</li>
      </ol>
      <div className="flex items-center space-x-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrollment.qrDataUrl}
          alt="QR code for your authenticator app"
          width={132}
          height={132}
          className="rounded-lg border border-blue-200 bg-white p-1"
        />
        <div className="space-y-1.5 min-w-0">
          <p className="font-semibold text-blue-900">Setup key</p>
          <p className="font-mono text-[12px] bg-white px-2 py-1.5 rounded border border-blue-200 break-all">
            {enrollment.setupKey}
          </p>
          <CopyButton text={enrollment.setupKey.replace(/\s/g, "")} label="Copy key" />
          <p className="text-slate-500">Account: {enrollment.issuer}</p>
        </div>
      </div>
      <p className="text-slate-600">
        This setup stays here until you finish it, so it&rsquo;s safe to refresh the page.
      </p>
    </div>
  );
}

/** Shown once, right after setup is confirmed. */
export function RecoveryCodesPanel({
  codes,
  onContinue,
  continueLabel = "Continue",
}: {
  codes: string[];
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-[11px] text-slate-800">
      <p className="font-bold text-amber-900 flex items-center space-x-1.5">
        <KeyRound className="w-4 h-4" />
        <span>Save your recovery codes</span>
      </p>
      <p>
        If you lose your phone, each code below lets you sign in once. This is the only
        time they&rsquo;re shown. Keep them somewhere safe, like a password manager.
      </p>
      <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px] bg-white p-3 rounded border border-amber-200">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <CopyButton text={codes.join("\n")} label="Copy all codes" />
      <label className="flex items-center space-x-2 font-semibold">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I&rsquo;ve saved these codes</span>
      </label>
      <button
        type="button"
        disabled={!saved}
        onClick={onContinue}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm"
      >
        {continueLabel}
      </button>
    </div>
  );
}
