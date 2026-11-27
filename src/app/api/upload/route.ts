import { NextRequest, NextResponse } from "next/server";
import { getActiveServerSession } from "@/lib/authSession";
import { storeFileViaConnector } from "@/lib/connectors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * §16.2 S4 & §16.3 G3: Secure Upload Endpoint
 * - Requires an active server-side session (`401` if logged out).
 * - Enforces file size limit (`15 MB`) and extension allowlist (`PDF`, images, Office docs, CSV, TXT; refuses `.html`, `.js`, etc.).
 * - Routes all writes through `storeFileViaConnector` into private storage (`storage/uploads/`, never `public/`).
 */
export async function POST(req: NextRequest) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required to upload files" },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let stored;
    try {
      stored = await storeFileViaConnector({
        originalName: file.name,
        buffer,
        mimeType: file.type,
      });
    } catch (validationErr) {
      return NextResponse.json(
        { error: String(validationErr) },
        { status: 400 }
      );
    }

    await prisma.auditLog.create({
      data: {
        actor: session.email,
        actorRole: `${session.identityType} (${session.role})`,
        action: "UPLOAD",
        objectType: "StorageFile",
        objectId: stored.storageKey,
        summary: `Uploaded file "${file.name}" (${stored.fileSizeLabel}) via storage connector`,
      },
    });

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      storageKey: stored.storageKey,
      fileUrl: stored.downloadUrl,
      fileSize: stored.fileSizeLabel,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
