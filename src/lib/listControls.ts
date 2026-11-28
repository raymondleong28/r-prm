// Shared list filtering: date range, property filters, paging and saved views.
// Pure functions so they can be tested without a browser.

export type DateRangePreset =
  | "all"
  | "last7"
  | "last30"
  | "last90"
  | "last365"
  | "thisMonth"
  | "thisYear"
  | "next30";

export const DATE_RANGE_OPTIONS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "all", label: "All time" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "last90", label: "Last 90 days" },
  { id: "last365", label: "Last 12 months" },
  { id: "thisMonth", label: "This month" },
  { id: "thisYear", label: "This year" },
  { id: "next30", label: "Next 30 days" },
];

export type FilterOperator =
  | "contains"
  | "is"
  | "isNot"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "lt";

export const FILTER_OPERATORS: Array<{ id: FilterOperator; label: string; needsValue: boolean }> = [
  { id: "contains", label: "contains", needsValue: true },
  { id: "is", label: "is", needsValue: true },
  { id: "isNot", label: "is not", needsValue: true },
  { id: "isEmpty", label: "is empty", needsValue: false },
  { id: "isNotEmpty", label: "is not empty", needsValue: false },
  { id: "gt", label: "greater than", needsValue: true },
  { id: "lt", label: "less than", needsValue: true },
];

export type PropertyFilter = { field: string; operator: FilterOperator; value: string };

export type ListViewState = {
  dateRange: DateRangePreset;
  filters: PropertyFilter[];
  pageSize: number;
};

export type SavedListView = ListViewState & { name: string; baseView: string };

export const PAGE_SIZES = [25, 50, 100];

export const DEFAULT_LIST_STATE: ListViewState = { dateRange: "all", filters: [], pageSize: 25 };

const HIDDEN_FIELD = /(json|hash|cipher|secret|token|password)$/i;

/** Fields a user can filter on: plain values only, no internal JSON or secrets. */
export function filterableFields(rows: Array<Record<string, unknown>>): string[] {
  const fields: string[] = [];
  for (const row of rows.slice(0, 200)) {
    for (const [key, value] of Object.entries(row)) {
      if (fields.includes(key) || HIDDEN_FIELD.test(key) || key === "id") continue;
      if (value !== null && typeof value === "object") continue;
      fields.push(key);
    }
  }
  return fields;
}

export function humaniseField(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateRangeBounds(preset: DateRangePreset, now = new Date()): [Date, Date] | null {
  const day = 86400000;
  const start = (n: number): [Date, Date] => [new Date(now.getTime() - n * day), now];
  switch (preset) {
    case "last7":
      return start(7);
    case "last30":
      return start(30);
    case "last90":
      return start(90);
    case "last365":
      return start(365);
    case "thisMonth":
      return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
    case "thisYear":
      return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
    case "next30":
      return [now, new Date(now.getTime() + 30 * day)];
    default:
      return null;
  }
}

export function matchesFilter(row: Record<string, unknown>, filter: PropertyFilter): boolean {
  const raw = row[filter.field];
  const text = raw === null || raw === undefined ? "" : String(raw);
  const target = filter.value.trim();
  switch (filter.operator) {
    case "isEmpty":
      return text.trim() === "";
    case "isNotEmpty":
      return text.trim() !== "";
    case "contains":
      return text.toLowerCase().includes(target.toLowerCase());
    case "is":
      return text.toLowerCase() === target.toLowerCase();
    case "isNot":
      return text.toLowerCase() !== target.toLowerCase();
    case "gt":
    case "lt": {
      const a = Number(text);
      const b = Number(target);
      if (Number.isFinite(a) && Number.isFinite(b) && text !== "" && target !== "") {
        return filter.operator === "gt" ? a > b : a < b;
      }
      const da = parseDate(text);
      const db = parseDate(target);
      if (da && db) return filter.operator === "gt" ? da > db : da < db;
      return false;
    }
    default:
      return true;
  }
}

export function applyListState<T extends Record<string, unknown>>(
  rows: T[],
  state: ListViewState,
  dateField: string | undefined,
  now = new Date()
): T[] {
  const bounds = dateField ? dateRangeBounds(state.dateRange, now) : null;
  return rows.filter((row) => {
    if (bounds && dateField) {
      const d = parseDate(row[dateField]);
      if (!d || d < bounds[0] || d >= bounds[1]) return false;
    }
    return state.filters.every((f) => matchesFilter(row, f));
  });
}

export function pageOf<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return { rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pageCount };
}

export function cleanSavedViews(value: unknown): SavedListView[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => v && typeof v === "object" && typeof (v as SavedListView).name === "string")
    .map((v) => {
      const sv = v as SavedListView;
      return {
        name: sv.name.trim(),
        baseView: String(sv.baseView || "All"),
        dateRange: DATE_RANGE_OPTIONS.some((o) => o.id === sv.dateRange) ? sv.dateRange : "all",
        filters: Array.isArray(sv.filters)
          ? sv.filters.filter((f) => f && typeof f.field === "string" && FILTER_OPERATORS.some((o) => o.id === f.operator))
          : [],
        pageSize: PAGE_SIZES.includes(Number(sv.pageSize)) ? Number(sv.pageSize) : 25,
      };
    })
    .filter((v) => v.name);
}
