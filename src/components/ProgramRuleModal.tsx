"use client";

import React, { useEffect, useState } from "react";
import { X, Check, Trash2, Plus } from "lucide-react";
import {
  DEFAULT_COMMISSION_TEMPLATES,
  StructuredRewardRule,
  SUPPORTED_CURRENCIES,
} from "@/lib/prmEngine";
import { REWARD_TRIGGERS, type RuleCondition } from "@/lib/rewardRules";
import { FILTER_OPERATORS, humaniseField, type FilterOperator } from "@/lib/listControls";
import {
  AGREED_IN_WRITING,
  CUSTOMER_FIELDS,
  NUMBER_FIELDS,
  TRANSACTION_FIELDS,
  TRANSACTION_RULE_TRIGGERS,
  describeRule,
  describeCondition,
  isAgreedInWriting,
  isLegacyCondition,
  toEditableRule,
  validateRule,
  type EditorCondition,
} from "@/lib/ruleEditing";

const CONDITION_TYPES: Array<{ id: string; label: string }> = [
  { id: "month_range", label: "Within a range of months" },
  { id: "transaction_count", label: "Based on the number of the customer's transactions" },
  { id: "transaction_sum", label: "Based on the total of the customer's transactions" },
  { id: "transaction_property", label: "Based on a transaction field" },
  { id: "customer_property", label: "Based on a customer field" },
  { id: "agreed_in_writing", label: "Only if a rate was agreed in writing before the order" },
];

function newCondition(type: string): EditorCondition {
  switch (type) {
    case "month_range":
      return { type: "month_range", fromMonth: 1, toMonth: 12 };
    case "transaction_count":
      return { type: "transaction_count", from: 1, to: 12 };
    case "transaction_sum":
      return { type: "transaction_sum", operator: "gte", value: 0 };
    case "transaction_property":
      return { type: "transaction_property", field: "", operator: "contains", value: "" };
    case "customer_property":
      return { type: "customer_property", field: "", operator: "contains", value: "" };
    default:
      return AGREED_IN_WRITING;
  }
}

const input = "w-full px-3 py-2 border border-slate-300 rounded-lg";
const small = "px-2 py-1 border border-slate-300 rounded w-20";

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
  const [addType, setAddType] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [wantConditions, setWantConditions] = useState(false);
  useEffect(() => {
    setWantConditions(false);
    setShowErrors(false);
    setAddType("");
  }, [open, editingRuleId]);
  if (!open) return null;

  const editableTemplates: Array<{ itemId?: string; rule: StructuredRewardRule }> =
    commissionTemplateItems.length > 0
      ? commissionTemplateItems.map((item) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(item.metadataJson || "{}");
          } catch {
            parsed = {};
          }
          return { itemId: item.id, rule: toEditableRule({ ...parsed, title: item.name || parsed.title }, baseCurrency) };
        })
      : Object.values(DEFAULT_COMMISSION_TEMPLATES).map((tpl) => ({ rule: toEditableRule(tpl, baseCurrency) }));

  const conditions = (ruleForm.conditions || []) as EditorCondition[];
  const isTransactionTrigger = TRANSACTION_RULE_TRIGGERS.has(String(ruleForm.trigger));
  const everyTime = conditions.length === 0 && !wantConditions;
  const errors = validateRule(ruleForm);
  const setConditions = (next: EditorCondition[]) => setRuleForm({ ...ruleForm, conditions: next });
  const updateCondition = (i: number, patch: Partial<RuleCondition>) =>
    setConditions(conditions.map((c, j) => (j === i ? ({ ...c, ...patch } as EditorCondition) : c)));
  const unit = ruleForm.amountMode === "fixed" ? "currency" : ruleForm.amountMode === "one_month_subscription" ? "subscription" : "percent";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    await onSaveRule(e);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-end">
      <form onSubmit={submit} className="bg-white h-full max-w-xl w-full shadow-2xl border-l border-slate-200 flex flex-col text-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">{editingRuleId ? "Edit reward" : "Add reward"}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800">Start from a template</span>
              <button type="button" onClick={() => onSaveAsTemplate(ruleForm)} className="text-[11px] font-semibold text-blue-700 hover:underline">
                + Save this reward as a template
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editableTemplates.map((entry, idx) => (
                <div key={entry.itemId || entry.rule.id || idx} className="inline-flex items-center rounded bg-white border border-blue-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...entry.rule, id: ruleForm.id, currency: entry.rule.currency || baseCurrency })}
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
            <label className="block font-semibold text-slate-700 mb-1">Label *</label>
            <input
              value={ruleForm.title}
              onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
              placeholder="e.g. 20% of monthly subscription, months 3–15"
              className={input}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              value={ruleForm.description || ""}
              onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
              placeholder="Shown to partners with the reward"
              className={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">How would you like to reward partners?</label>
              <select
                value={ruleForm.valueType}
                onChange={(e) => setRuleForm({ ...ruleForm, valueType: e.target.value as StructuredRewardRule["valueType"] })}
                className={input}
              >
                {["Cash", "Credit", "Gift card", "Coupon"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">What triggers the reward?</label>
              <select
                value={ruleForm.trigger}
                onChange={(e) => {
                  const trigger = e.target.value as StructuredRewardRule["trigger"];
                  const keepConditions = TRANSACTION_RULE_TRIGGERS.has(trigger)
                    ? conditions
                    : conditions.filter((c) => isAgreedInWriting(c) || isLegacyCondition(c));
                  setRuleForm({ ...ruleForm, trigger, conditions: keepConditions, rateSteps: TRANSACTION_RULE_TRIGGERS.has(trigger) ? ruleForm.rateSteps : [] });
                }}
                className={input}
              >
                {REWARD_TRIGGERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isTransactionTrigger && (
            <div className="space-y-2">
              <p className="font-semibold text-slate-700">Reward every transaction?</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={everyTime}
                    onChange={() => {
                      setWantConditions(false);
                      setConditions([]);
                    }}
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={!everyTime}
                    onChange={() => {
                      setWantConditions(true);
                      if (conditions.length === 0) setConditions([newCondition("month_range")]);
                    }}
                  />
                  <span>No, only when conditions are met</span>
                </label>
              </div>
            </div>
          )}

          {(!isTransactionTrigger || !everyTime) && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="font-bold text-slate-800">Conditions (all must be met)</p>
              {conditions.map((c, i) => {
                const rc = c as RuleCondition;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    {isLegacyCondition(c) && (
                      <span className="text-slate-700">
                        Older condition: {describeCondition(c)} <span className="text-slate-400">(kept as saved; remove it to replace it)</span>
                      </span>
                    )}
                    {isAgreedInWriting(c) && (
                      <span className="text-slate-700">
                        Only if a rate was agreed in writing before the order was accepted (uses that rate)
                      </span>
                    )}
                    {rc.type === "month_range" && (
                      <>
                        <span>From month</span>
                        <input type="number" min={1} value={rc.fromMonth} onChange={(e) => updateCondition(i, { fromMonth: Number(e.target.value) })} className={small} />
                        <span>to month</span>
                        <input type="number" min={1} value={rc.toMonth >= 9999 ? "" : rc.toMonth} placeholder="no end" onChange={(e) => updateCondition(i, { toMonth: e.target.value === "" ? 9999 : Number(e.target.value) })} className={small} />
                        <span className="text-slate-400">counted from the customer&rsquo;s first transaction</span>
                      </>
                    )}
                    {rc.type === "transaction_count" && (
                      <>
                        <span>From the customer&rsquo;s transaction no.</span>
                        <input type="number" min={1} value={rc.from} onChange={(e) => updateCondition(i, { from: Number(e.target.value) })} className={small} />
                        <span>to no.</span>
                        <input type="number" min={1} value={rc.to} onChange={(e) => updateCondition(i, { to: Number(e.target.value) })} className={small} />
                      </>
                    )}
                    {rc.type === "transaction_sum" && (
                      <>
                        <span>When the customer&rsquo;s transactions total</span>
                        <select value={rc.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as "gte" | "lte" })} className="px-2 py-1 border border-slate-300 rounded">
                          <option value="gte">at least</option>
                          <option value="lte">at most</option>
                        </select>
                        <input type="number" min={0} value={rc.value} onChange={(e) => updateCondition(i, { value: Number(e.target.value) })} className="px-2 py-1 border border-slate-300 rounded w-28" />
                      </>
                    )}
                    {(rc.type === "transaction_property" || rc.type === "customer_property") && (
                      <>
                        <span>If {rc.type === "transaction_property" ? "transaction" : "customer"}</span>
                        <select value={rc.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className="px-2 py-1 border border-slate-300 rounded">
                          <option value="">Choose a field…</option>
                          {(rc.type === "transaction_property" ? TRANSACTION_FIELDS : CUSTOMER_FIELDS).map((f) => (
                            <option key={f} value={f}>
                              {humaniseField(f)}
                            </option>
                          ))}
                        </select>
                        <select value={rc.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as FilterOperator })} className="px-2 py-1 border border-slate-300 rounded">
                          {FILTER_OPERATORS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {FILTER_OPERATORS.find((o) => o.id === rc.operator)?.needsValue && (
                          <input value={rc.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="Value" className="px-2 py-1 border border-slate-300 rounded w-32" />
                        )}
                      </>
                    )}
                    <button type="button" onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="ml-auto text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <select value={addType} onChange={(e) => setAddType(e.target.value)} className="px-2 py-1 border border-slate-300 rounded bg-white">
                  <option value="">Add a condition…</option>
                  {CONDITION_TYPES.filter((t) => isTransactionTrigger || t.id === "agreed_in_writing").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addType}
                  onClick={() => {
                    setConditions([...conditions, newCondition(addType)]);
                    setAddType("");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 text-white font-semibold disabled:bg-slate-300"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-semibold text-slate-700">How much do partners receive?</p>
            <div className="flex flex-wrap items-center gap-2">
              {unit !== "subscription" && (
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={ruleForm.rateSteps && ruleForm.rateSteps.length > 0 && unit === "percent" ? "" : ruleForm.rateOrAmount}
                  disabled={Boolean(ruleForm.rateSteps && ruleForm.rateSteps.length > 0 && unit === "percent")}
                  placeholder={ruleForm.rateSteps && ruleForm.rateSteps.length > 0 ? "set by month below" : ""}
                  onChange={(e) => setRuleForm({ ...ruleForm, rateOrAmount: Number(e.target.value) })}
                  className="px-3 py-2 border border-slate-300 rounded-lg w-32"
                />
              )}
              <select
                value={unit === "currency" ? ruleForm.currency || baseCurrency : unit === "percent" ? "%" : "subscription"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "%") setRuleForm({ ...ruleForm, amountMode: "percentage" });
                  else if (v === "subscription") setRuleForm({ ...ruleForm, amountMode: "one_month_subscription", rateOrAmount: 100, rateSteps: [] });
                  else setRuleForm({ ...ruleForm, amountMode: "fixed", currency: v, rateSteps: [] });
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="%">%</option>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {isTransactionTrigger && <option value="subscription">1 month&rsquo;s subscription</option>}
              </select>
              {unit === "percent" && (
                <>
                  <span>of</span>
                  <select
                    value={ruleForm.percentOfField || "amount"}
                    onChange={(e) => setRuleForm({ ...ruleForm, percentOfField: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {NUMBER_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {humaniseField(f)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {unit === "percent" && isTransactionTrigger && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Change the rate by month (optional)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const steps = ruleForm.rateSteps || [];
                      const last = steps[steps.length - 1];
                      const from = last ? last.toMonth + 1 : 1;
                      setRuleForm({ ...ruleForm, rateSteps: [...steps, { fromMonth: from, toMonth: from + 11, ratePct: last ? last.ratePct : ruleForm.rateOrAmount || 10 }] });
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold text-[11px]"
                  >
                    + Add a rate period
                  </button>
                </div>
                {(ruleForm.rateSteps || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500">Same rate every month.</p>
                ) : (
                  (ruleForm.rateSteps || []).map((step, sIdx) => (
                    <div key={sIdx} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <input type="number" min={0} step="0.01" value={step.ratePct} onChange={(e) => {
                        const next = [...(ruleForm.rateSteps || [])];
                        next[sIdx] = { ...next[sIdx], ratePct: Number(e.target.value) };
                        setRuleForm({ ...ruleForm, rateSteps: next });
                      }} className={small} />
                      <span>% from month</span>
                      <input type="number" min={1} value={step.fromMonth} onChange={(e) => {
                        const next = [...(ruleForm.rateSteps || [])];
                        next[sIdx] = { ...next[sIdx], fromMonth: Number(e.target.value) };
                        setRuleForm({ ...ruleForm, rateSteps: next });
                      }} className={small} />
                      <span>to month</span>
                      <input type="number" min={1} value={step.toMonth} onChange={(e) => {
                        const next = [...(ruleForm.rateSteps || [])];
                        next[sIdx] = { ...next[sIdx], toMonth: Number(e.target.value) };
                        setRuleForm({ ...ruleForm, rateSteps: next });
                      }} className={small} />
                      <button type="button" onClick={() => setRuleForm({ ...ruleForm, rateSteps: (ruleForm.rateSteps || []).filter((_, i) => i !== sIdx) })} className="ml-auto text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  ))
                )}
                {(ruleForm.rateSteps || []).length > 0 && (
                  <p className="text-[11px] text-slate-500">Months outside these periods earn nothing.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={ruleForm.requiresValidation} onChange={(e) => setRuleForm({ ...ruleForm, requiresValidation: e.target.checked })} />
              <span className="font-medium text-slate-800">Create rewards as Pending until an admin validates them</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={ruleForm.clawbackOnRefund} onChange={(e) => setRuleForm({ ...ruleForm, clawbackOnRefund: e.target.checked })} />
              <span className="font-medium text-slate-800">Reverse the reward if the payment is refunded</span>
            </label>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-[10px] font-bold uppercase text-emerald-800 mb-1">This reward pays</p>
            <p className="text-emerald-950">{describeRule(ruleForm, baseCurrency)}</p>
          </div>

          {showErrors && errors.length > 0 && (
            <ul className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 list-disc pl-6 space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1">
            <Check className="w-3.5 h-3.5" />
            <span>{editingRuleId ? "Save reward" : "Add reward"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
