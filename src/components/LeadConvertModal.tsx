"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/prmEngine";

export function LeadConvertModal({
  lead,
  defaultCurrency,
  onClose,
  onSubmit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lead: any | null;
  defaultCurrency: string;
  onClose: () => void;
  onSubmit: (payload: {
    leadId: string;
    amount: number;
    currency: string;
    dealName?: string;
    closeDate?: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(
    defaultCurrency || SUPPORTED_CURRENCIES[0]
  );
  const [dealName, setDealName] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setAmount("");
      setCurrency(defaultCurrency || SUPPORTED_CURRENCIES[0]);
      setDealName("");
      setCloseDate("");
      setError("");
    }
  }, [lead, defaultCurrency]);

  if (!lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsedAmount = Number(amount);
    if (
      amount.trim() === "" ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("Enter a deal amount greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        leadId: lead.id,
        amount: parsedAmount,
        currency,
        dealName: dealName.trim() || undefined,
        closeDate: closeDate || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
      >
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Convert lead to deal</h3>
            <p className="text-[11px] text-blue-100">
              {lead.firstName} {lead.lastName} · {lead.company}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Deal amount *
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Deal name (optional)
            </label>
            <input
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder={`OPP - ${lead.company}`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Expected close date (optional)
            </label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
          >
            {submitting ? "Converting..." : "Convert to Deal"}
          </button>
        </div>
      </form>
    </div>
  );
}
