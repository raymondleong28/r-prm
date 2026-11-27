import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/authSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        error: "Authentication required",
      },
      { status: 401 }
    );
  }
  if (session.identityType !== "coworker") {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        error: "Forbidden: Partner users cannot access the internal Audit Log",
      },
      { status: 403 }
    );
  }

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({
      lookupStatus: "found",
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return NextResponse.json(
      { lookupStatus: "could_not_check", reason: String(error) },
      { status: 500 }
    );
  }
}
