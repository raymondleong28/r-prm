// Server side of custom fields: definitions in ManageItem ("custom_properties"), values in each
// record's customFieldsJson (products keep theirs in metadataJson.customFields).

import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { RprmSession } from "./authSession";
import { writeAudit } from "./importAndEmailHelpers";
import {
  checkCustomValues,
  checkDefinition,
  definitionFromItem,
  definitionsFromItems,
  isCustomFieldObject,
  parseStoredValues,
  type CustomFieldDefinition,
  type CustomFieldObject,
  type CustomFieldValues,
} from "./customFieldDefs";

/** Create actions that may carry `customFields`, and the records they create. */
const CREATE_ACTIONS: Record<string, CustomFieldObject> = {
  CREATE_PARTNER: "Partners",
  CREATE_TEAM_MEMBER: "Contacts",
  CREATE_LEAD: "Leads",
  CREATE_DEAL: "Deals",
  CREATE_CUSTOMER: "Customers",
  CREATE_TRANSACTION: "Transactions",
  CREATE_TASK: "Tasks",
  CREATE_REWARD: "Rewards",
  CREATE_PAYOUT: "Payouts",
};

export async function loadDefinitions(objectType?: CustomFieldObject, includeArchived = false): Promise<CustomFieldDefinition[]> {
  const items = await prisma.manageItem.findMany({ where: { category: "custom_properties" }, orderBy: { createdAt: "asc" } });
  return definitionsFromItems(items, objectType, includeArchived);
}

type Store = {
  read: (id: string) => Promise<{ label: string; values: CustomFieldValues } | null>;
  write: (id: string, values: CustomFieldValues) => Promise<void>;
  all: () => Promise<CustomFieldValues[]>;
};

function columnStore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labelOf: (r: any) => string
): Store {
  return {
    read: async (id) => {
      const r = await delegate.findUnique({ where: { id } });
      return r ? { label: labelOf(r), values: parseStoredValues(r.customFieldsJson) } : null;
    },
    write: async (id, values) => {
      await delegate.update({ where: { id }, data: { customFieldsJson: JSON.stringify(values) } });
    },
    all: async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((await delegate.findMany({ select: { customFieldsJson: true } })) as any[]).map((r) => parseStoredValues(r.customFieldsJson)),
  };
}

function metaOf(item: { metadataJson: string }): Record<string, unknown> {
  try {
    return JSON.parse(item.metadataJson || "{}");
  } catch {
    return {};
  }
}

const productStore: Store = {
  read: async (id) => {
    const item = await prisma.manageItem.findUnique({ where: { id } });
    if (!item || item.category !== "products") return null;
    return { label: item.name, values: parseStoredValues(metaOf(item).customFields) };
  },
  write: async (id, values) => {
    const item = await prisma.manageItem.findUniqueOrThrow({ where: { id } });
    await prisma.manageItem.update({
      where: { id },
      data: { metadataJson: JSON.stringify({ ...metaOf(item), customFields: values }) },
    });
  },
  all: async () =>
    (await prisma.manageItem.findMany({ where: { category: "products" } })).map((i) => parseStoredValues(metaOf(i).customFields)),
};

export function storeFor(objectType: CustomFieldObject): Store {
  switch (objectType) {
    case "Contacts":
      return columnStore(prisma.partnerTeamMember, (r) => r.name);
    case "Customers":
      return columnStore(prisma.customer, (r) => r.name);
    case "Deals":
      return columnStore(prisma.deal, (r) => r.name);
    case "Leads":
      return columnStore(prisma.lead, (r) => `${r.firstName} ${r.lastName}`.trim());
    case "Partners":
      return columnStore(prisma.partner, (r) => r.name);
    case "Rewards":
      return columnStore(prisma.reward, (r) => r.rewardNumber);
    case "Payouts":
      return columnStore(prisma.payout, (r) => r.payoutNumber);
    case "Tasks":
      return columnStore(prisma.task, (r) => r.name);
    case "Transactions":
      return columnStore(prisma.transaction, (r) => r.name);
    case "Products":
      return productStore;
  }
}

/**
 * Checks `payload.customFields` on a create action before anything is written.
 * Returns the JSON to store on the new record, or an error response.
 */
export async function prepareCreateCustomFields(
  session: RprmSession,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): Promise<{ json: string; error?: undefined } | { error: NextResponse; json?: undefined }> {
  const objectType = CREATE_ACTIONS[action];
  const incoming = payload?.customFields;
  if (!objectType || incoming === undefined || incoming === null) return { json: "{}" };
  if (session.identityType === "partner") {
    return { error: NextResponse.json({ error: "Custom fields are managed by your partner manager." }, { status: 403 }) };
  }
  const result = checkCustomValues(await loadDefinitions(objectType), incoming);
  if (!result.ok) return { error: NextResponse.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 }) };
  return { json: JSON.stringify(result.values) };
}

async function optionInUse(objectType: CustomFieldObject, key: string, options: string[]): Promise<string[]> {
  const rows = await storeFor(objectType).all();
  return options.filter((o) => rows.some((v) => String(v[key] ?? "").toLowerCase() === o.toLowerCase()));
}

/** Custom-field actions. Returns null for any other action. Admin (coworker) sessions only. */
export async function executeCustomFieldMutation(
  session: RprmSession,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): Promise<NextResponse | null> {
  if (!["SAVE_CUSTOM_FIELD_DEFINITION", "SET_CUSTOM_FIELD_ARCHIVED", "UPDATE_CUSTOM_FIELDS"].includes(action)) return null;
  if (session.identityType !== "coworker") {
    return NextResponse.json({ error: "Only your team can change custom fields." }, { status: 403 });
  }

  if (action === "SAVE_CUSTOM_FIELD_DEFINITION") {
    const all = await loadDefinitions(undefined, true);
    const editing = payload?.id ? all.find((d) => d.id === payload.id) : undefined;
    if (payload?.id && !editing) return NextResponse.json({ error: "That custom field no longer exists." }, { status: 404 });
    const checked = checkDefinition(payload || {}, all, editing);
    if (!checked.ok) return NextResponse.json({ error: checked.errors.join(" "), errors: checked.errors }, { status: 400 });
    if (editing && checked.removedOptions.length) {
      const used = await optionInUse(editing.objectType, editing.key, checked.removedOptions);
      if (used.length) {
        return NextResponse.json(
          { error: `Can't remove ${used.map((o) => `"${o}"`).join(", ")}: records still use it. Change those records first.` },
          { status: 409 }
        );
      }
    }
    const metadata = { objectType: checked.objectType, fieldType: checked.fieldType, key: checked.key, options: checked.options };
    const item = editing
      ? await prisma.manageItem.update({
          where: { id: editing.id },
          data: { name: checked.label, metadataJson: JSON.stringify(metadata), subtitle: "" },
        })
      : await prisma.manageItem.create({
          data: { category: "custom_properties", name: checked.label, status: "Active", subtitle: "", metadataJson: JSON.stringify(metadata) },
        });
    await writeAudit({
      session,
      action: editing ? "UPDATE" : "CREATE",
      objectType: "CustomField",
      objectId: item.id,
      summary: `${editing ? "Updated" : "Created"} ${checked.objectType} custom field "${checked.label}" (${checked.fieldType})`,
      diff: metadata,
    });
    return NextResponse.json({ ok: true, definition: definitionFromItem(item) });
  }

  if (action === "SET_CUSTOM_FIELD_ARCHIVED") {
    const item = await prisma.manageItem.findUnique({ where: { id: String(payload?.id || "") } });
    if (!item || item.category !== "custom_properties") {
      return NextResponse.json({ error: "That custom field no longer exists." }, { status: 404 });
    }
    const archived = Boolean(payload?.archived);
    const updated = await prisma.manageItem.update({ where: { id: item.id }, data: { status: archived ? "Archived" : "Active" } });
    await writeAudit({
      session,
      action: "UPDATE",
      objectType: "CustomField",
      objectId: item.id,
      summary: `${archived ? "Archived" : "Restored"} custom field "${item.name}" (stored values kept)`,
    });
    return NextResponse.json({ ok: true, definition: definitionFromItem(updated) });
  }

  // UPDATE_CUSTOM_FIELDS
  const objectType = payload?.objectType;
  if (!isCustomFieldObject(objectType)) return NextResponse.json({ error: "Unknown record type." }, { status: 400 });
  const id = String(payload?.id || "");
  const store = storeFor(objectType);
  const record = id ? await store.read(id) : null;
  if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  const result = checkCustomValues(await loadDefinitions(objectType, true), payload?.values, record.values);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 });
  if (result.changed.length === 0) return NextResponse.json({ ok: true, values: result.values, changed: [] });
  await store.write(id, result.values);
  const diff: Record<string, unknown> = {};
  for (const k of result.changed) diff[k] = { from: record.values[k] ?? null, to: result.values[k] ?? null };
  await writeAudit({
    session,
    action: "UPDATE",
    objectType: objectType.replace(/s$/, ""),
    objectId: id,
    summary: `Updated custom fields on "${record.label}": ${result.changed.join(", ")}`,
    diff,
  });
  return NextResponse.json({ ok: true, values: result.values, changed: result.changed });
}
