"use client";

import { useMemo, useState } from "react";
import { usePrm } from "@/context/PrmContext";
import {
  applyListState,
  cleanSavedViews,
  DEFAULT_LIST_STATE,
  filterableFields,
  pageOf,
  type ListViewState,
  type SavedListView,
} from "@/lib/listControls";

export type ListControls = ReturnType<typeof useListControls>;

/**
 * Date range, property filters, paging and saved views for a list page.
 * `rows` are the rows after the page's own built-in view and search.
 */
export function useListControls<T extends Record<string, unknown>>(
  listKey: string,
  rows: T[],
  options: { dateField?: string; dateLabel?: string } = {}
) {
  const { settings, mutate, showToast } = usePrm();
  const [state, setState] = useState<ListViewState>(DEFAULT_LIST_STATE);
  const [page, setPage] = useState(1);
  const [activeSavedView, setActiveSavedView] = useState<string | null>(null);

  const allSaved = (settings?.saved_views && typeof settings.saved_views === "object"
    ? settings.saved_views
    : {}) as Record<string, unknown>;
  const savedViews = cleanSavedViews(allSaved[listKey]);

  const filteredRows = useMemo(
    () => applyListState(rows, state, options.dateField),
    [rows, state, options.dateField]
  );
  const paged = pageOf(filteredRows, page, state.pageSize);
  const fields = useMemo(() => filterableFields(rows), [rows]);

  const update = (patch: Partial<ListViewState>) => {
    setState((s) => ({ ...s, ...patch }));
    setPage(1);
  };

  const persist = async (next: SavedListView[], message: string) => {
    const res = await mutate(
      "SAVE_SETTING",
      { key: "saved_views", value: { ...allSaved, [listKey]: next } },
      message
    );
    return Boolean(res);
  };

  return {
    listKey,
    dateField: options.dateField,
    dateLabel: options.dateLabel || "Creation date",
    state,
    update,
    page: paged.page,
    pageCount: paged.pageCount,
    setPage,
    pageRows: paged.rows,
    filteredRows,
    filteredCount: filteredRows.length,
    totalCount: rows.length,
    fields,
    savedViews,
    activeSavedView,
    clearSavedView: () => {
      setActiveSavedView(null);
      setState(DEFAULT_LIST_STATE);
      setPage(1);
    },
    loadSavedView: (view: SavedListView) => {
      setActiveSavedView(view.name);
      setState({ dateRange: view.dateRange, filters: view.filters, pageSize: view.pageSize });
      setPage(1);
    },
    saveAsNew: async (name: string, baseView: string) => {
      const clean = name.trim();
      if (!clean) return false;
      if (savedViews.some((v) => v.name.toLowerCase() === clean.toLowerCase())) {
        showToast(`A view called "${clean}" already exists`);
        return false;
      }
      const ok = await persist([...savedViews, { name: clean, baseView, ...state }], `Saved view "${clean}"`);
      if (ok) setActiveSavedView(clean);
      return ok;
    },
    saveCurrent: async () => {
      if (!activeSavedView) return false;
      return persist(
        savedViews.map((v) => (v.name === activeSavedView ? { ...v, ...state } : v)),
        `Updated view "${activeSavedView}"`
      );
    },
    renameView: async (from: string, to: string) => {
      const clean = to.trim();
      if (!clean || savedViews.some((v) => v.name.toLowerCase() === clean.toLowerCase())) return false;
      const ok = await persist(
        savedViews.map((v) => (v.name === from ? { ...v, name: clean } : v)),
        `Renamed view to "${clean}"`
      );
      if (ok && activeSavedView === from) setActiveSavedView(clean);
      return ok;
    },
    deleteView: async (name: string) => {
      const ok = await persist(savedViews.filter((v) => v.name !== name), `Deleted view "${name}"`);
      if (ok && activeSavedView === name) {
        setActiveSavedView(null);
        setState(DEFAULT_LIST_STATE);
      }
      return ok;
    },
  };
}
