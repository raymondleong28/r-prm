"use client";

import React from "react";
import { X, Check, Trash2 } from "lucide-react";
import {
  DEFAULT_COMMISSION_TEMPLATES,
  StructuredRewardRule,
  SUPPORTED_CURRENCIES,
  normalizeRewardRule,
} from "@/lib/prmEngine";

export function ProgramRuleModal({
  open,
  editingRuleId,
  ruleForm,
  setRuleForm,
  baseCurrency,
  commissionTemplateItems,
  onClose,
  onSaveRule,
  onSaveAsTemplate,
  onDeleteTemplate,
}: {
  open: boolean;
  editingRuleId: string | null;
  ruleForm: StructuredRewardRule;
  setRuleForm: React.Dispatch<React.SetStateAction<StructuredRewardRule>>;
  baseCurrency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commissionTemplateItems: any[];
  onClose: () => void;
  onSaveRule: (e: React.FormEvent) => Promise<void>;
  onSaveAsTemplate: (rule: StructuredRewardRule) => Promise<void>;
  onDeleteTemplate: (templateItemId: string) => Promise<void>;
}) {
  if (!open) return null;

  const editableTemplates: Array<{
    itemId?: string;
    rule: StructuredRewardRule;
  }> =
    commissionTemplateItems.length > 0
      ? commissionTemplateItems.map((item) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(item.metadataJson || "{}");
          } catch {
            parsed = {};
          }
          return {
            itemId: item.id,
            rule: normalizeRewardRule(
              { ...parsed, title: item.name || parsed.title },
              baseCurrency
            ),
          };
        })
      : Object.values(DEFAULT_COMMISSION_TEMPLATES).map((tpl) => ({
          rule: { ...tpl, currency: tpl.currency || baseCurrency },
        }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <form
        onSubmit={onSaveRule}
        className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
      >
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm">
            {editingRuleId
              ? "Edit Structured Commission Rule"
              : "Create Structured Commission Rule"}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* §3.5.2: Editable Commission Templates stored in database data */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800">
                Load commission template
              </span>
              <button
                type="button"
                onClick={() => onSaveAsTemplate(ruleForm)}
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                + Save current rule as template
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editableTemplates.map((entry, idx) => (
                <div
                  key={entry.itemId || entry.rule.id || idx}
                  className="inline-flex items-center rounded bg-white border border-blue-300 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setRuleForm({
                        ...entry.rule,
                        id: ruleForm.id,
                        currency: entry.rule.currency || baseCurrency,
                      })
                    }
                    className="px-2.5 py-1 text-blue-700 font-semibold hover:bg-blue-100 text-left"
                  >
                    {entry.rule.title}
                  </button>
                  {entry.itemId && (
                    <button
                      type="button"
                      title="Delete template"
                      onClick={() => onDeleteTemplate(entry.itemId!)}
                      className="px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 border-l border-blue-200"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Rule Title *
            </label>
            <input
              required
              value={ruleForm.title}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, title: e.target.value })
              }
              placeholder="e.g. 15% Recurring Subscription Commission"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Trigger Event
              </label>
              <select
                value={ruleForm.trigger}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    trigger: e.target.value as StructuredRewardRule["trigger"],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="transaction_paid">
                  On paid transaction from won deal
                </option>
                <option value="deal_closed_won">
                  When deal moves to Closed Won
                </option>
                <option value="lead_accepted">
                  When partner lead is accepted
                </option>
                <option value="lead_converted">
                  When lead converts to deal
                </option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Value Type
              </label>
              <select
                value={ruleForm.valueType}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    valueType: e.target
                      .value as StructuredRewardRule["valueType"],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="Cash">Cash</option>
                <option value="Coupon">Coupon (Not yet configured)</option>
                <option value="Gift card">Gift card (Not yet configured)</option>
                <option value="Credit">Credit (Not yet configured)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amount Mode
              </label>
              <select
                value={ruleForm.amountMode}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    amountMode: e.target
                      .value as StructuredRewardRule["amountMode"],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
                <option value="one_month_subscription">
                  1 Month Subscription Fee
                </option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rate (%) or Fixed Amount
              </label>
              <input
                type="number"
                value={ruleForm.rateOrAmount}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    rateOrAmount: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={ruleForm.currency || baseCurrency}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Duration Mode
              </label>
              <select
                value={ruleForm.duration}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    duration: e.target.value as StructuredRewardRule["duration"],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="one_off">One-off</option>
                <option value="recurring">Recurring (N months)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Start at Billing Month
              </label>
              <input
                type="number"
                value={ruleForm.startOffsetMonths ?? 1}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    startOffsetMonths: Number(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Duration (Months)
              </label>
              <input
                type="number"
                value={ruleForm.durationMonths ?? 12}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    durationMonths: Number(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {ruleForm.duration === "recurring" && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Recurring Rate Steps (e.g. 20% M4–15, 10% M16–27)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRuleForm({
                      ...ruleForm,
                      rateSteps: [
                        ...(ruleForm.rateSteps || []),
                        { fromMonth: 4, toMonth: 15, ratePct: 20 },
                      ],
                    })
                  }
                  className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold text-[11px]"
                >
                  + Add Rate Step
                </button>
              </div>
              {(ruleForm.rateSteps || []).length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No rate steps defined (uses flat rate above for all recurring
                  months).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(ruleForm.rateSteps || []).map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="grid grid-cols-4 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                    >
                      <div>
                        <label className="block text-[10px] text-slate-500">
                          From Month
                        </label>
                        <input
                          type="number"
                          value={step.fromMonth}
                          onChange={(e) => {
                            const next = [...(ruleForm.rateSteps || [])];
                            next[sIdx] = {
                              ...next[sIdx],
                              fromMonth: Number(e.target.value) || 1,
                            };
                            setRuleForm({ ...ruleForm, rateSteps: next });
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">
                          To Month
                        </label>
                        <input
                          type="number"
                          value={step.toMonth}
                          onChange={(e) => {
                            const next = [...(ruleForm.rateSteps || [])];
                            next[sIdx] = {
                              ...next[sIdx],
                              toMonth: Number(e.target.value) || 1,
                            };
                            setRuleForm({ ...ruleForm, rateSteps: next });
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">
                          Rate (%)
                        </label>
                        <input
                          type="number"
                          value={step.ratePct}
                          onChange={(e) => {
                            const next = [...(ruleForm.rateSteps || [])];
                            next[sIdx] = {
                              ...next[sIdx],
                              ratePct: Number(e.target.value) || 0,
                            };
                            setRuleForm({ ...ruleForm, rateSteps: next });
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </div>
                      <div className="text-right pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const next = (ruleForm.rateSteps || []).filter(
                              (_, i) => i !== sIdx
                            );
                            setRuleForm({ ...ruleForm, rateSteps: next });
                          }}
                          className="px-2 py-1 rounded text-red-600 hover:bg-red-50 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={ruleForm.requiresValidation}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    requiresValidation: e.target.checked,
                  })
                }
              />
              <span className="font-medium text-slate-800">
                Create as Pending until Admin validates
              </span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={ruleForm.clawbackOnRefund}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    clawbackOnRefund: e.target.checked,
                  })
                }
              />
              <span className="font-medium text-slate-800">
                Clawback (reverse) if underlying payment is refunded
              </span>
            </label>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{editingRuleId ? "Save Rule" : "Confirm & Add Rule"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
