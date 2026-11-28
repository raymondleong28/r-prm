"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Check, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { usePrm } from "@/context/PrmContext";
import {
  CUSTOM_FIELD_OBJECTS,
  CUSTOM_FIELD_TYPES,
  definitionsFromItems,
  displayValue,
  parseStoredValues,
  type CustomFieldDefinition,
  type CustomFieldObject,
  type CustomFieldValues,
} from "@/lib/customFieldDefs";

const inputCls = "w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs";

/** Draft form values (strings / booleans) → what the server expects. */
export type CustomFieldDraft = Record<string, string | boolean>;

export function draftFromValues(defs: CustomFieldDefinition[], values: CustomFieldValues): CustomFieldDraft {
  const draft: CustomFieldDraft = {};
  for (const d of defs) {
    const v = values[d.key];
    draft[d.key] = d.fieldType === "checkbox" ? v === true : v === undefined ? "" : String(v);
  }
  return draft;
}

/** Live definitions for one record type, from the workspace's manage items. */
export function useCustomFieldDefs(objectType: CustomFieldObject, includeArchived = false) {
  const { manageItems } = usePrm();
  return useMemo(() => definitionsFromItems(manageItems || [], objectType, includeArchived), [manageItems, objectType, includeArchived]);
}

/** Inputs for a record's custom fields (used in create forms and the detail panel). */
export function CustomFieldInputs({
  defs,
  draft,
  onChange,
}: {
  defs: CustomFieldDefinition[];
  draft: CustomFieldDraft;
  onChange: (next: CustomFieldDraft) => void;
}) {
  if (defs.length === 0) return null;
  const set = (key: string, value: string | boolean) => onChange({ ...draft, [key]: value });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {defs.map((d) => {
        const v = draft[d.key];
        const id = `cf-${d.key}`;
        return (
          <div key={d.id} className={d.fieldType === "checkbox" ? "flex items-center gap-2 pt-5" : ""}>
            {d.fieldType === "checkbox" ? (
              <>
                <input id={id} type="checkbox" checked={v === true} onChange={(e) => set(d.key, e.target.checked)} />
                <label htmlFor={id} className="font-semibold text-slate-700 text-xs">
                  {d.label}
                </label>
              </>
            ) : (
              <>
                <label htmlFor={id} className="block font-semibold text-slate-700 mb-1 text-xs">
                  {d.label}
                </label>
                {d.fieldType === "select" ? (
                  <select id={id} value={String(v ?? "")} onChange={(e) => set(d.key, e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {d.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={d.fieldType === "number" ? "number" : d.fieldType === "email" ? "email" : d.fieldType === "date" ? "date" : "text"}
                    step={d.fieldType === "number" ? "any" : undefined}
                    value={String(v ?? "")}
                    onChange={(e) => set(d.key, e.target.value)}
                    className={inputCls}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A create form's custom fields: renders nothing when the record type has none. */
export function CreateFormCustomFields({
  objectType,
  draft,
  onChange,
}: {
  objectType: CustomFieldObject;
  draft: CustomFieldDraft;
  onChange: (next: CustomFieldDraft) => void;
}) {
  const defs = useCustomFieldDefs(objectType);
  if (defs.length === 0) return null;
  return (
    <div className="pt-2 border-t border-slate-100 space-y-2">
      <p className="text-[11px] font-bold uppercase text-slate-500">Custom fields</p>
      <CustomFieldInputs defs={defs} draft={draft} onChange={onChange} />
    </div>
  );
}

/** Only fields the admin filled in, ready to send as `customFields`; undefined when empty. */
export function customFieldsPayload(draft: CustomFieldDraft): Record<string, string | boolean> | undefined {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(draft)) if (v !== "" && v !== false) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

/** Custom fields on a detail page: view, edit, save (team only). */
export function CustomFieldsPanel({
  objectType,
  recordId,
  stored,
}: {
  objectType: CustomFieldObject;
  recordId: string;
  stored: unknown;
}) {
  const { mutate, session } = usePrm();
  const liveDefs = useCustomFieldDefs(objectType);
  const allDefs = useCustomFieldDefs(objectType, true);
  const values = parseStoredValues(stored);
  // Archived fields still show a value the record already has (read-only)
  const archivedWithValue = allDefs.filter((d) => d.archived && values[d.key] !== undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CustomFieldDraft>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const storedKey = typeof stored === "string" ? stored : JSON.stringify(stored ?? {});

  useEffect(() => {
    if (!editing) setDraft(draftFromValues(liveDefs, parseStoredValues(stored)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey, liveDefs, editing]);

  if (session?.identityType === "partner") return null;

  const save = async () => {
    setSaving(true);
    const res = await mutate("UPDATE_CUSTOM_FIELDS", { objectType, id: recordId, values: draft }, "Custom fields saved");
    setSaving(false);
    if (res?.ok) {
      setErrors([]);
      setEditing(false);
    } else {
      setErrors(res?.errors || [res?.error || "Couldn't save."]);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-3" data-testid="custom-fields-panel">
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-900">Custom fields</p>
        {liveDefs.length > 0 && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700">
            <Pencil className="w-3 h-3" />
            <span>Edit</span>
          </button>
        )}
      </div>
      {liveDefs.length === 0 && archivedWithValue.length === 0 ? (
        <p className="text-slate-500">
          No custom fields for {objectType.toLowerCase()} yet.{" "}
          <Link href="/account/properties" className="text-blue-700 hover:underline">
            Add them in Account settings → Properties
          </Link>
          .
        </p>
      ) : editing ? (
        <div className="space-y-3">
          <CustomFieldInputs defs={liveDefs} draft={draft} onChange={setDraft} />
          {errors.length > 0 && (
            <ul className="p-2 rounded bg-red-50 border border-red-200 text-red-700 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setErrors([]);
              }}
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-slate-400">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {[...liveDefs, ...archivedWithValue].map((d) => (
            <div key={d.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1">
              <dt className="text-slate-500">
                {d.label}
                {d.archived ? " (archived)" : ""}
              </dt>
              <dd className="font-semibold text-slate-900 text-right">{displayValue(d, values[d.key])}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Account settings → Properties: create, rename, add options, archive / restore. */
export function CustomFieldsBuilder() {
  const { mutate } = usePrm();
  const [objectType, setObjectType] = useState<CustomFieldObject>("Customers");
  const defs = useCustomFieldDefs(objectType, true);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<string>("text");
  const [options, setOptions] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editOptions, setEditOptions] = useState("");
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutate(
      "SAVE_CUSTOM_FIELD_DEFINITION",
      { label, objectType, fieldType, options },
      `Custom field "${label.trim()}" added to ${objectType}`
    );
    if (res?.ok) {
      setLabel("");
      setOptions("");
      setErrors([]);
    } else setErrors(res?.errors || [res?.error || "Couldn't save."]);
  };

  const saveEdit = async (d: CustomFieldDefinition) => {
    const res = await mutate("SAVE_CUSTOM_FIELD_DEFINITION", { id: d.id, label: editLabel, options: editOptions }, "Custom field updated");
    if (res?.ok) {
      setEditId(null);
      setEditErrors([]);
    } else setEditErrors(res?.errors || [res?.error || "Couldn't save."]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Custom fields</h2>
        <p className="text-slate-500 mt-1">
          Extra fields for your records. They appear on create forms and detail pages, in list filters and CSV export, and
          customer and transaction fields can be used in reward rules.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CUSTOM_FIELD_OBJECTS.map((obj) => (
          <button
            key={obj}
            onClick={() => {
              setObjectType(obj);
              setEditId(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold ${objectType === obj ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {obj}
          </button>
        ))}
      </div>

      <form onSubmit={create} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block font-medium text-slate-700 mb-1">New {objectType.toLowerCase()} field</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Billing period" className={inputCls} />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Type</label>
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1">
            <Plus className="w-3.5 h-3.5" />
            <span>Add field</span>
          </button>
        </div>
        {fieldType === "select" && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">Options (comma or one per line)</label>
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={2} placeholder="Monthly, Quarterly, Yearly" className={inputCls} />
          </div>
        )}
        <p className="text-[11px] text-slate-500">The type can&rsquo;t be changed later, so stored values keep their meaning.</p>
        {errors.length > 0 && (
          <ul className="p-2 rounded bg-red-50 border border-red-200 text-red-700 list-disc pl-5">
            {errors.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        )}
      </form>

      {defs.length === 0 ? (
        <p className="text-slate-500">No custom fields for {objectType.toLowerCase()} yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {defs.map((d) => (
            <div key={d.id} className="py-2.5 space-y-2" data-testid={`custom-field-${d.key}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`font-bold ${d.archived ? "text-slate-400 line-through" : "text-slate-900"}`}>{d.label}</p>
                  <p className="text-slate-500">
                    {CUSTOM_FIELD_TYPES.find((t) => t.id === d.fieldType)?.label}
                    {d.fieldType === "select" ? ` · ${d.options.join(", ") || "no options yet"}` : ""} · key <code>{d.key}</code>
                    {d.archived ? " · archived (values kept, hidden from forms)" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!d.archived && (
                    <button
                      onClick={() => {
                        setEditId(d.id);
                        setEditLabel(d.label);
                        setEditOptions(d.options.join(", "));
                        setEditErrors([]);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 font-semibold"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                  <button
                    onClick={() =>
                      mutate(
                        "SET_CUSTOM_FIELD_ARCHIVED",
                        { id: d.id, archived: !d.archived },
                        d.archived ? `Restored "${d.label}"` : `Archived "${d.label}"`
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 font-semibold"
                  >
                    {d.archived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    <span>{d.archived ? "Restore" : "Archive"}</span>
                  </button>
                </div>
              </div>
              {editId === d.id && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Name</label>
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={inputCls} />
                    </div>
                    {d.fieldType === "select" && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Options</label>
                        <input value={editOptions} onChange={(e) => setEditOptions(e.target.value)} className={inputCls} />
                      </div>
                    )}
                  </div>
                  {editErrors.length > 0 && (
                    <ul className="p-2 rounded bg-red-50 border border-red-200 text-red-700 list-disc pl-5">
                      {editErrors.map((er) => (
                        <li key={er}>{er}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditId(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-slate-600 hover:bg-slate-200">
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                    <button onClick={() => saveEdit(d)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 text-white font-semibold">
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
