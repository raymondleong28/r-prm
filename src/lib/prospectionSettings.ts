// Prospection board configuration, stored in account_settings.
// Stages are the board's columns; card fields choose what each partner card shows.

export const DEFAULT_PROSPECTION_STAGES = ["New", "Onboarding", "Active"];

export const PROSPECTION_CARD_FIELDS = [
  { id: "partnerType", label: "Partner type" },
  { id: "programLevel", label: "Program level" },
  { id: "program", label: "Program" },
  { id: "status", label: "Status badge" },
  { id: "owner", label: "Owner" },
  { id: "country", label: "Country" },
  { id: "createdAt", label: "Creation date" },
] as const;

export type ProspectionCardFieldId = (typeof PROSPECTION_CARD_FIELDS)[number]["id"];

export const DEFAULT_PROSPECTION_CARD_FIELDS: ProspectionCardFieldId[] = [
  "partnerType",
  "programLevel",
  "status",
  "owner",
];

const FIELD_IDS = new Set<string>(PROSPECTION_CARD_FIELDS.map((f) => f.id));

export function cleanStageList(stages: unknown): string[] {
  if (!Array.isArray(stages)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stages) {
    const name = String(raw ?? "").trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readProspectionSettings(acct: any): {
  stages: string[];
  cardFields: ProspectionCardFieldId[];
} {
  const stages = cleanStageList(acct?.prospectionStages);
  const cardFields = Array.isArray(acct?.prospectionCardFields)
    ? (acct.prospectionCardFields as unknown[])
        .map(String)
        .filter((f): f is ProspectionCardFieldId => FIELD_IDS.has(f))
    : DEFAULT_PROSPECTION_CARD_FIELDS;
  return {
    stages: stages.length > 0 ? stages : DEFAULT_PROSPECTION_STAGES,
    cardFields,
  };
}
