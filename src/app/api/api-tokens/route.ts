import { NextRequest, NextResponse } from "next/server";
import { getActiveServerSession, type RprmSession } from "@/lib/authSession";
import { prisma } from "@/lib/prisma";
import { createApiToken, publicTokenView } from "@/lib/apiTokens";

export const dynamic = "force-dynamic";

/** Administrators signed in through the app (not through another token) manage API tokens. */
async function requireAdmin(req: NextRequest): Promise<RprmSession | NextResponse> {
  const session = await getActiveServerSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.sessionId.startsWith("api-token:")) {
    return NextResponse.json({ error: "API tokens can't manage API tokens" }, { status: 403 });
  }
  if (session.identityType !== "coworker" || session.role !== "Administrator") {
    return NextResponse.json({ error: "Only administrators can manage API tokens" }, { status: 403 });
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (session instanceof NextResponse) return session;
  const rows = await prisma.apiToken.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tokens: rows.map(publicTokenView) });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (session instanceof NextResponse) return session;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Give the token a name" }, { status: 400 });
  const { raw, row } = await createApiToken({
    name,
    createdById: session.userId,
    createdByEmail: session.email,
  });
  await prisma.auditLog.create({
    data: {
      actor: session.email,
      actorRole: `${session.identityType} (${session.role})`,
      action: "CREATE",
      objectType: "ApiToken",
      objectId: row.id,
      summary: `Created API token "${row.name}" (${row.prefix}…)`,
    },
  });
  return NextResponse.json({ token: raw, tokenInfo: publicTokenView(row) });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req);
  if (session instanceof NextResponse) return session;
  const id = new URL(req.url).searchParams.get("id") || "";
  const row = await prisma.apiToken.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Token not found" }, { status: 404 });
  if (!row.revokedAt) {
    await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        actor: session.email,
        actorRole: `${session.identityType} (${session.role})`,
        action: "UPDATE",
        objectType: "ApiToken",
        objectId: row.id,
        summary: `Revoked API token "${row.name}" (${row.prefix}…)`,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
