"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  PROSPECTION_CARD_FIELDS,
  type ProspectionCardFieldId,
} from "@/lib/prospectionSettings";

type Props = {
  partnerTypes: string[];
  setPartnerTypes: (v: string[]) => void;
  stages: string[];
  setStages: (v: string[]) => void;
  cardFields: ProspectionCardFieldId[];
  setCardFields: (v: ProspectionCardFieldId[]) => void;
  stageCounts: Record<string, number>;
};

function addUnique(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v || list.some((x) => x.toLowerCase() === v.toLowerCase())) return list;
  return [...list, v];
}

/** Partner settings: partner types, prospection board columns and card fields. Saved with the rest of Partner settings. */
export function PartnerPipelineSettings({
  partnerTypes,
  setPartnerTypes,
  stages,
  setStages,
  cardFields,
  setCardFields,
  stageCounts,
}: Props) {
  const [newType, setNewType] = useState("");
  const [newStage, setNewStage] = useState("");

  const moveStage = (index: number, delta: number) => {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStages(next);
  };

  return (
    <>
      <div className="p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Partner types</h3>
        {partnerTypes.length === 0 && (
          <p className="text-slate-500">No partner types yet. Add the ones your programs use.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {partnerTypes.map((pt) => (
            <span
              key={pt}
              className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
            >
              <span>{pt}</span>
              <button
                type="button"
                aria-label={`Remove ${pt}`}
                onClick={() => setPartnerTypes(partnerTypes.filter((x) => x !== pt))}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="Add a partner type"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            onClick={() => {
              setPartnerTypes(addUnique(partnerTypes, newType));
              setNewType("");
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900">Prospection board columns</h4>
          <p className="text-slate-500">
            Columns appear on the Prospection board in this order. Partners in a removed column
            show under &ldquo;Not in a column&rdquo; until you move them.
          </p>
          <ol className="space-y-1.5">
            {stages.map((stage, i) => (
              <li key={stage} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800">
                  {i + 1}. {stage}{" "}
                  <span className="text-slate-400 font-normal">({stageCounts[stage] || 0})</span>
                </span>
                <span className="flex items-center space-x-1">
                  <button type="button" aria-label="Move up" onClick={() => moveStage(i, -1)} disabled={i === 0}>
                    <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1}>
                    <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${stage}`}
                    disabled={stages.length <= 1}
                    onClick={() => setStages(stages.filter((s) => s !== stage))}
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Add a column"
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                setStages(addUnique(stages, newStage));
                setNewStage("");
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900">Prospection card fields</h4>
          <p className="text-slate-500">Choose what each partner card shows (the partner name is always shown).</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PROSPECTION_CARD_FIELDS.map((f) => (
              <label key={f.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={cardFields.includes(f.id)}
                  onChange={(e) =>
                    setCardFields(
                      e.target.checked
                        ? PROSPECTION_CARD_FIELDS.map((x) => x.id).filter(
                            (id) => id === f.id || cardFields.includes(id)
                          )
                        : cardFields.filter((x) => x !== f.id)
                    )
                  }
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
