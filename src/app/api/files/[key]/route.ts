import { NextRequest, NextResponse } from "next/server";
import { getActiveServerSession } from "@/lib/authSession";
import { readFileViaConnector } from "@/lib/connectors";
import { prisma } from "@/lib/prisma";
import { canPartnerAccessAsset } from "@/lib/prmEngine";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * §16.2 S4 & §16.3 G3: Authorized File Download Route
 * - Rejects unauthenticated downloads with HTTP 401.
 * - For partner users, verifies that if the file is attached to an Asset, the partner is authorized to access that Asset.
 * - Reads exclusively through `readFileViaConnector` from private storage outside `public/`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required to download files" },
      { status: 401 }
    );
  }

  const key = decodeURIComponent(params.key || "");
  if (!key) {
    return NextResponse.json({ error: "Missing file key" }, { status: 400 });
  }

  if (session.identityType === "partner" && session.partnerId) {
    const partner = await prisma.partner.findUnique({
      where: { id: session.partnerId },
    });
    const allAssets = await prisma.manageItem.findMany({
      where: { category: "assets" },
    });
    const matchingAsset = allAssets.find((a) =>
      (a.metadataJson || "").includes(key)
    );
    if (matchingAsset && partner && !canPartnerAccessAsset(matchingAsset, partner)) {
      return NextResponse.json(
        { error: "Forbidden: partner does not have access to this asset file" },
        { status: 403 }
      );
    }
  }

  const fileObj = await readFileViaConnector(key);
  if (!fileObj) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const contentType = MIME_BY_EXT[fileObj.ext] || "application/octet-stream";
  return new NextResponse(new Uint8Array(fileObj.buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${key.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
