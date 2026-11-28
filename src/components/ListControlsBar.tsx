"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import {
  DATE_RANGE_OPTIONS,
  FILTER_OPERATORS,
  PAGE_SIZES,
  humaniseField,
  type DateRangePreset,
  type FilterOperator,
} from "@/lib/listControls";
import type { ListControls } from "@/components/useListControls";

type Props = {
  views: string[];
  activeView: string;
  onSelectView: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  controls?: ListControls;
};

const btn =
  "px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center space-x-1";

/** View tabs, search, date range, filters, saved views and paging for a list page. */
export function ListControlsBar({ views, activeView, onSelectView, search, onSearchChange, controls }: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [naming, setNaming] = useState<null | { mode: "new" } | { mode: "rename"; from: string }>(null);
  const [nameInput, setNameInput] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<{ field: string; operator: FilterOperator; value: string }>({
    field: "",
    operator: "contains",
    value: "",
  });

  const active = controls?.activeSavedView;
  const dateLabel =
    DATE_RANGE_OPTIONS.find((o) => o.id === controls?.state.dateRange)?.label || "All time";
  const operatorNeedsValue = FILTER_OPERATORS.find((o) => o.id === draft.operator)?.needsValue;

  const submitName = async () => {
    if (!controls || !naming) return;
    const ok =
      naming.mode === "new"
        ? await controls.saveAsNew(nameInput, activeView)
        : await controls.renameView(naming.from, nameInput);
    if (ok) {
      setNaming(null);
      setNameInput("");
    }
  };

  return (
    <>
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => {
                controls?.clearSavedView();
                onSelectView(v);
              }}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${
                activeView === v && !active
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
          {controls?.savedViews.map((sv) => (
            <button
              key={`saved-${sv.name}`}
              onClick={() => {
                onSelectView(sv.baseView);
                controls.loadSavedView(sv);
              }}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${
                active === sv.name
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {sv.name}
            </button>
          ))}
          {controls && (
            <>
              <button
                onClick={() => {
                  setNaming({ mode: "new" });
                  setNameInput("");
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md whitespace-nowrap"
              >
                + Add view
              </button>
              {controls.savedViews.length > 0 && (
                <button
                  onClick={() => setManageOpen(!manageOpen)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-md whitespace-nowrap"
                >
                  Manage views
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {controls && naming && (
        <div className="max-w-[1440px] mx-auto px-6 py-2 bg-blue-50/60 border-t border-blue-100 flex items-center gap-2 text-xs">
          <span className="font-semibold text-blue-900">
            {naming.mode === "new" ? "Save current filters as a view:" : `Rename "${naming.from}":`}
          </span>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            placeholder="View name"
            className="px-2.5 py-1 border border-slate-300 rounded-md w-56"
          />
          <button onClick={submitName} className="px-3 py-1 rounded-md bg-blue-600 text-white font-semibold">
            Save
          </button>
          <button onClick={() => setNaming(null)} className="px-3 py-1 rounded-md border border-slate-300 bg-white">
            Cancel
          </button>
        </div>
      )}

      {controls && manageOpen && (
        <div className="max-w-[1440px] mx-auto px-6 py-2 bg-slate-50 border-t border-slate-200 text-xs space-y-1">
          <p className="font-semibold text-slate-700">Saved views</p>
          {controls.savedViews.map((sv) => (
            <div key={sv.name} className="flex items-center gap-3">
              <span className="font-semibold text-slate-800 w-48 truncate">{sv.name}</span>
              <span className="text-slate-500">
                based on {sv.baseView} · {sv.filters.length} filter(s) ·{" "}
                {DATE_RANGE_OPTIONS.find((o) => o.id === sv.dateRange)?.label}
              </span>
              <button
                onClick={() => {
                  setNaming({ mode: "rename", from: sv.name });
                  setNameInput(sv.name);
                }}
                className="text-blue-600 hover:underline"
              >
                Rename
              </button>
              <button onClick={() => controls.deleteView(sv.name)} className="text-red-600 hover:underline">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-6 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs w-56 focus:outline-none focus:border-blue-600"
            />
          </div>

          {controls?.dateField && (
            <div className="relative">
              <button onClick={() => setDateOpen(!dateOpen)} className={btn}>
                <span>
                  {controls.dateLabel}: {dateLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {dateOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                  {DATE_RANGE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        controls.update({ dateRange: o.id as DateRangePreset });
                        setDateOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${
                        controls.state.dateRange === o.id ? "text-blue-700 font-semibold" : "text-slate-700"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {controls && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center space-x-1.5 ${
                showFilters || controls.state.filters.length > 0
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {showFilters ? "Hide filters" : "Show filters"}
                {controls.state.filters.length > 0 ? ` (${controls.state.filters.length})` : ""}
              </span>
            </button>
          )}

          {controls && (
            <div className="relative">
              <button onClick={() => setViewMenuOpen(!viewMenuOpen)} className={btn}>
                <span>View</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {viewMenuOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                  <button
                    disabled={!active}
                    onClick={async () => {
                      setViewMenuOpen(false);
                      await controls.saveCurrent();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-white"
                  >
                    Save changes to view
                  </button>
                  <button
                    onClick={() => {
                      setViewMenuOpen(false);
                      setNaming({ mode: "new" });
                      setNameInput("");
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50"
                  >
                    Save as new view
                  </button>
                  <button
                    disabled={!active}
                    onClick={() => {
                      setViewMenuOpen(false);
                      if (active) {
                        setNaming({ mode: "rename", from: active });
                        setNameInput(active);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-white"
                  >
                    Rename view
                  </button>
                  <button
                    disabled={!active}
                    onClick={async () => {
                      setViewMenuOpen(false);
                      if (active) await controls.deleteView(active);
                    }}
                    className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-white"
                  >
                    Delete view
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {controls && (
          <div className="flex items-center space-x-2 text-slate-600">
            <span>
              {controls.filteredCount === controls.totalCount
                ? `${controls.totalCount} items`
                : `${controls.filteredCount} of ${controls.totalCount} items`}
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center space-x-1">
              <span>Show</span>
              <select
                value={controls.state.pageSize}
                onChange={(e) => controls.update({ pageSize: Number(e.target.value) })}
                className="border border-slate-300 rounded-md px-1 py-0.5 bg-white"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Previous page"
              disabled={controls.page <= 1}
              onClick={() => controls.setPage(controls.page - 1)}
              className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Page {controls.page} of {controls.pageCount}
            </span>
            <button
              aria-label="Next page"
              disabled={controls.page >= controls.pageCount}
              onClick={() => controls.setPage(controls.page + 1)}
              className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {controls && showFilters && (
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 bg-blue-50/60 border-t border-blue-100 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {controls.state.filters.length === 0 && <span className="text-slate-500">No filters yet.</span>}
            {controls.state.filters.map((f, i) => (
              <span
                key={`${f.field}-${i}`}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-800 font-semibold"
              >
                <span>
                  {humaniseField(f.field)} {FILTER_OPERATORS.find((o) => o.id === f.operator)?.label}
                  {FILTER_OPERATORS.find((o) => o.id === f.operator)?.needsValue ? ` "${f.value}"` : ""}
                </span>
                <button
                  aria-label="Remove filter"
                  onClick={() => controls.update({ filters: controls.state.filters.filter((_, j) => j !== i) })}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.field || (operatorNeedsValue && !draft.value.trim())) return;
              controls.update({ filters: [...controls.state.filters, { ...draft, value: draft.value.trim() }] });
              setDraft({ field: draft.field, operator: "contains", value: "" });
            }}
          >
            <select
              value={draft.field}
              onChange={(e) => setDraft({ ...draft, field: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1 bg-white"
            >
              <option value="">Choose a field…</option>
              {controls.fields.map((f) => (
                <option key={f} value={f}>
                  {humaniseField(f)}
                </option>
              ))}
            </select>
            <select
              value={draft.operator}
              onChange={(e) => setDraft({ ...draft, operator: e.target.value as FilterOperator })}
              className="border border-slate-300 rounded-md px-2 py-1 bg-white"
            >
              {FILTER_OPERATORS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {operatorNeedsValue && (
              <input
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                placeholder="Value"
                className="border border-slate-300 rounded-md px-2 py-1 bg-white w-44"
              />
            )}
            <button type="submit" className="px-3 py-1 rounded-md bg-blue-600 text-white font-semibold">
              Add filter
            </button>
            {controls.state.filters.length > 0 && (
              <button
                type="button"
                onClick={() => controls.update({ filters: [] })}
                className="text-blue-700 hover:underline"
              >
                Clear all
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
