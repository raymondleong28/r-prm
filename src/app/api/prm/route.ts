import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// §13.1 & §13.7 Slice 1:
// Retired /api/prm so there is only ONE source of truth (the per-object /api/[resource] endpoints).
export async function GET() {
  return NextResponse.json(
    {
      retired: true,
      lookupStatus: "not_found",
      error:
        "/api/prm has been retired (§13.7 Slice 1). Use per-object endpoints (/api/programs, /api/partners, /api/leads, /api/deals, /api/rewards, /api/assets, /api/audit, etc.).",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      retired: true,
      error:
        "/api/prm has been retired (§13.7 Slice 1). Send mutations to per-object endpoints (/api/partners, /api/programs, /api/leads, /api/deals, /api/rewards, etc.).",
    },
    { status: 410 }
  );
}
