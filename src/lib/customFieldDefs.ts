// Custom fields: definitions (stored as ManageItem category "custom_properties") and the
// rules for checking values. Pure functions only, so forms and the server use the same checks.

export const CUSTOM_FIELD_OBJECTS = [
  "Contacts",
  "Customers",
  "Deals",
  "Leads",
  "Partners",
  "Rewards",
  "Payouts",
  "Tasks",
  "Transactions",
  "Products",
] as const;
export type CustomFieldObject = (typeof CUSTOM_FIELD_OBJECTS)[number];

export const CUSTOM_FIELD_TYPES = [
  { id: "text", label: "Text" },
  { id: "number", label: "Number" },
  { id: "email", label: "Email" },
  { id: "checkbox", label: "Checkbox" },
  { id: "select", label: "Single select" },
  { id: "date", label: "Date" },
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]["id"];

export type CustomFieldValue = string | number | boolean;
export type CustomFieldValues = Record<string, CustomFieldValue>;

export type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  objectType: CustomFieldObject;
  fieldType: CustomFieldType;
  options: string[];
  archived: boolean;
};

/** Prefix used when custom values sit next to built-in fields (lists, filters, export, reward rules). */
export const CUSTOM_PREFIX = "custom.";

const LEGACY_TYPES: Record<string, CustomFieldType> = {
  "single line text": "text",
  text: "text",
  number: "number",
  email: "email",
  checkbox: "checkbox",
  "single select": "select",
  select: "select",
  date: "date",
};

export function normaliseFieldType(raw: unknown): CustomFieldType {
  return LEGACY_TYPES[String(raw ?? "").trim().toLowerCase()] || "text";
}

export function isCustomFieldObject(raw: unknown): raw is CustomFieldObject {
  return (CUSTOM_FIELD_OBJECTS as readonly string[]).includes(String(raw));
}

/** "Billing Period (months)" → "billing_period_months" */
export function keyFromLabel(label: string): string {
  return (
    String(label)
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "field"
  );
}

export function cleanOptions(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[\n,]/);
  const out: string[] = [];
  for (const item of list) {
    const v = String(item).trim().slice(0, 80);
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function definitionFromItem(item: any): CustomFieldDefinition | null {
  if (!item || item.category !== "custom_properties") return null;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(item.metadataJson || "{}");
  } catch {
    meta = {};
  }
  const objectType = isCustomFieldObject(meta.objectType) ? meta.objectType : null;
  if (!objectType) return null;
  const label = String(item.name || "").trim();
  return {
    id: String(item.id),
    key: typeof meta.key === "string" && meta.key ? meta.key : keyFromLabel(label),
    label,
    objectType,
    fieldType: normaliseFieldType(meta.fieldType),
    options: cleanOptions(meta.options),
    archived: item.status === "Archived",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function definitionsFromItems(items: any[], objectType?: CustomFieldObject, includeArchived = false): CustomFieldDefinition[] {
  const byAge = [...(items || [])].sort((a, b) => String(a?.createdAt ?? "").localeCompare(String(b?.createdAt ?? "")));
  return byAge
    .map(definitionFromItem)
    .filter((d): d is CustomFieldDefinition => Boolean(d))
    .filter((d) => (!objectType || d.objectType === objectType) && (includeArchived || !d.archived));
}

export function parseStoredValues(raw: unknown): CustomFieldValues {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as CustomFieldValues;
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** { billing_period: 1 } → { "custom.billing_period": 1 } */
export function flattenCustomValues(values: CustomFieldValues): Record<string, CustomFieldValue> {
  const out: Record<string, CustomFieldValue> = {};
  for (const [k, v] of Object.entries(values)) out[`${CUSTOM_PREFIX}${k}`] = v;
  return out;
}

export function displayValue(def: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  if (def.fieldType === "checkbox") return value === true ? "Yes" : "No";
  return String(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks incoming values against the definitions and merges them into the existing values.
 * Empty / null removes a value. Unknown or archived fields are refused.
 */
export function checkCustomValues(
  defs: CustomFieldDefinition[],
  incoming: unknown,
  existing: CustomFieldValues = {}
): { ok: true; values: CustomFieldValues; changed: string[] } | { ok: false; errors: string[] } {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return { ok: false, errors: ["Custom fields must be sent as an object of field → value."] };
  }
  const errors: string[] = [];
  const values: CustomFieldValues = { ...existing };
  const changed: string[] = [];
  for (const [key, raw] of Object.entries(incoming as Record<string, unknown>)) {
    const def = defs.find((d) => d.key === key);
    if (!def) {
      errors.push(`"${key}" is not a custom field here.`);
      continue;
    }
    if (def.archived) {
      errors.push(`"${def.label}" is archived and can't be changed.`);
      continue;
    }
    const empty = raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (key in values) changed.push(key);
      delete values[key];
      continue;
    }
    let value: CustomFieldValue | null = null;
    switch (def.fieldType) {
      case "number": {
        const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
        if (Number.isFinite(n)) value = n;
        else errors.push(`"${def.label}" needs a number.`);
        break;
      }
      case "checkbox":
        if (typeof raw === "boolean") value = raw;
        else if (["true", "yes", "1"].includes(String(raw).toLowerCase())) value = true;
        else if (["false", "no", "0"].includes(String(raw).toLowerCase())) value = false;
        else errors.push(`"${def.label}" must be yes or no.`);
        break;
      case "email": {
        const s = String(raw).trim();
        if (EMAIL.test(s) && s.length <= 254) value = s.toLowerCase();
        else errors.push(`"${def.label}" needs a valid email address.`);
        break;
      }
      case "select": {
        const s = String(raw).trim();
        const match = def.options.find((o) => o.toLowerCase() === s.toLowerCase());
        if (match) value = match;
        else errors.push(`"${def.label}" must be one of: ${def.options.join(", ") || "(no options set)"}.`);
        break;
      }
      case "date": {
        const s = String(raw).trim();
        const d = new Date(`${s}T00:00:00Z`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s) value = s;
        else errors.push(`"${def.label}" needs a date (YYYY-MM-DD).`);
        break;
      }
      default: {
        const s = String(raw).trim();
        if (s.length <= 1000) value = s;
        else errors.push(`"${def.label}" is too long (1,000 characters max).`);
      }
    }
    if (value !== null) {
      if (values[key] !== value) changed.push(key);
      values[key] = value;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, values, changed };
}

/** Checks a definition before it's saved. */
export function checkDefinition(
  input: { label?: unknown; objectType?: unknown; fieldType?: unknown; options?: unknown },
  others: CustomFieldDefinition[],
  editing?: CustomFieldDefinition
):
  | { ok: true; label: string; key: string; objectType: CustomFieldObject; fieldType: CustomFieldType; options: string[]; removedOptions: string[] }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const label = String(input.label ?? "").trim().slice(0, 80);
  if (!label) errors.push("Give the field a name.");
  const objectType = editing ? editing.objectType : isCustomFieldObject(input.objectType) ? input.objectType : null;
  if (!objectType) errors.push("Choose which records the field belongs to.");
  // Type and key are fixed once created, so stored values always keep their meaning.
  const fieldType = editing ? editing.fieldType : normaliseFieldType(input.fieldType);
  const key = editing ? editing.key : keyFromLabel(label);
  const options = fieldType === "select" ? cleanOptions(input.options) : [];
  if (fieldType === "select" && options.length === 0) errors.push("Add at least one option.");
  const removedOptions =
    editing && fieldType === "select"
      ? editing.options.filter((o) => !options.some((n) => n.toLowerCase() === o.toLowerCase()))
      : [];
  if (objectType && others.some((d) => d.objectType === objectType && d.key === key && d.id !== editing?.id)) {
    errors.push(`${objectType} already has a field called "${label}".`);
  }
  if (errors.length || !objectType) return { ok: false, errors };
  return { ok: true, label, key, objectType, fieldType, options, removedOptions };
}
