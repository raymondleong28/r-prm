import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { RprmSession } from "./authSession";
import {
  writeAudit,
  sendAndLogTransactionalEmail,
} from "./importAndEmailHelpers";

export async function executeWorkspaceAdminMutation(
  session: RprmSession,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  todayIso: string
) {
  switch (action) {
    case "CREATE_ACCOUNT_RECORD": {
      const acc = await prisma.accountRecord.create({
        data: {
          accountName: String(payload.accountName || "").trim(),
          type: payload.type || "Prospect",
          ownerName: payload.ownerName || session.name,
          ownerEmail: payload.ownerEmail || session.email,
          source: payload.source || "Manual Account Mapping",
          importedDate: todayIso,
          hasOverlap: Boolean(payload.partnerName),
          partnerName: String(payload.partnerName || "").trim(),
          partnerAccountName: String(
            payload.partnerAccountName || payload.accountName || ""
          ).trim(),
          partnerAccountType: payload.partnerAccountType || "Customer",
          partnerOwnerName: String(payload.partnerOwnerName || "").trim(),
          partnerOwnerEmail: String(payload.partnerOwnerEmail || "").trim(),
          overlapDate: todayIso,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "AccountRecord",
        objectId: acc.id,
        summary: `Mapped account "${acc.accountName}"`,
      });
      return NextResponse.json({ ok: true, account: acc });
    }

    case "CREATE_COLLABORATION": {
      const col = await prisma.collaboration.create({
        data: {
          name: String(payload.name || "").trim(),
          status: payload.status || "New",
          ownerId: payload.ownerId || session.userId,
          owner: payload.owner || session.name,
          partnerName: String(payload.partnerName || "").trim(),
          assignedContact: String(payload.assignedContact || "").trim(),
          accountName: String(payload.accountName || "").trim(),
          lastActivityDate: todayIso,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Collaboration",
        objectId: col.id,
        summary: `Created collaboration "${col.name}"`,
      });
      return NextResponse.json({ ok: true, collaboration: col });
    }

    case "CREATE_DATA_SOURCE": {
      const ds = await prisma.dataSource.create({
        data: {
          name: String(payload.name || "").trim(),
          status: "Active",
          sharedWith: String(payload.sharedWith || "").trim(),
          type: payload.type || "CSV Upload",
          accountType: payload.accountType || "Customers & Prospects",
          lastImportedDate: todayIso,
          createdBy: session.name,
        },
      });
      if (Array.isArray(payload.csvAccounts)) {
        for (const row of payload.csvAccounts) {
          await prisma.accountRecord.create({
            data: {
              accountName: row.accountName,
              type: row.yourType || "Prospect",
              ownerName: session.name,
              ownerEmail: session.email,
              source: payload.name,
              importedDate: todayIso,
              hasOverlap: Boolean(row.partnerName),
              partnerName: row.partnerName || "",
              partnerAccountName: row.partnerAccountName || row.accountName,
              partnerAccountType: row.partnerType || "Customer",
              partnerOwnerName: row.partnerOwnerName || "",
              partnerOwnerEmail: row.partnerOwnerEmail || "",
              overlapDate: todayIso,
            },
          });
        }
      }
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "DataSource",
        objectId: ds.id,
        summary: `Imported account mapping data source "${ds.name}"`,
      });
      return NextResponse.json({ ok: true, dataSource: ds });
    }

    case "CREATE_MANAGE_ITEM": {
      const item = await prisma.manageItem.create({
        data: {
          category: payload.category,
          name: payload.name,
          subtitle: payload.subtitle || "",
          status: payload.status || "Active",
          metadataJson: JSON.stringify(payload.metadata || {}),
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: `Manage:${payload.category}`,
        objectId: item.id,
        summary: `Created ${payload.category} item "${item.name}"`,
      });
      return NextResponse.json({ ok: true, item });
    }

    case "UPDATE_MANAGE_ITEM": {
      const existing = await prisma.manageItem.findUnique({
        where: { id: payload.id },
      });
      let mergedMeta = {};
      if (existing?.metadataJson) {
        try {
          mergedMeta = JSON.parse(existing.metadataJson);
        } catch {
          mergedMeta = {};
        }
      }
      if (payload.metadata) {
        mergedMeta = { ...mergedMeta, ...payload.metadata };
      }
      const item = await prisma.manageItem.update({
        where: { id: payload.id },
        data: {
          name: payload.name ?? existing?.name,
          subtitle: payload.subtitle ?? existing?.subtitle,
          status: payload.status ?? existing?.status,
          metadataJson: JSON.stringify(mergedMeta),
        },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: `Manage:${item.category}`,
        objectId: item.id,
        summary: `Updated ${item.category} item "${item.name}"`,
      });
      return NextResponse.json({ ok: true, item });
    }

    case "ASSIGN_GROUP_PARTNERS": {
      const { groupName, partnerIds } = payload;
      if (Array.isArray(partnerIds) && partnerIds.length > 0) {
        await prisma.partner.updateMany({
          where: { id: { in: partnerIds } },
          data: { groupName },
        });
      }
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "PartnerGroup",
        objectId: groupName,
        summary: `Assigned ${partnerIds?.length || 0} partners to group "${groupName}"`,
      });
      return NextResponse.json({ ok: true });
    }

    case "TOGGLE_MANAGE_ITEM_STATUS": {
      const item = await prisma.manageItem.update({
        where: { id: payload.id },
        data: { status: payload.status },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: `Manage:${item.category}`,
        objectId: item.id,
        summary: `Toggled ${item.name} status to ${payload.status}`,
      });
      return NextResponse.json({ ok: true, item });
    }

    case "DELETE_MANAGE_ITEM": {
      await prisma.manageItem.delete({ where: { id: payload.id } });
      await writeAudit({
        session,
        action: "DELETE",
        objectType: "ManageItem",
        objectId: payload.id,
        summary: `Deleted manage item ${payload.id}`,
      });
      return NextResponse.json({ ok: true });
    }

    case "SEND_EMAIL": {
      const result = await sendAndLogTransactionalEmail({
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        templateName: payload.templateName,
        mergeFields: payload.mergeFields,
      });
      await writeAudit({
        session,
        action: "EMAIL",
        objectType: "EmailOutbox",
        objectId: result.emailLog.id,
        summary: `Sent email "${result.emailLog.name}" to ${payload.to}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    case "LOG_IMPERSONATION": {
      if (!payload.partnerId) {
        return NextResponse.json(
          { error: "Partner ID is required" },
          { status: 400 }
        );
      }
      await writeAudit({
        session,
        action: "IMPERSONATE",
        objectType: "PartnerPortal",
        objectId: payload.partnerId,
        summary: `Admin ${session.email} opened Partner Portal impersonation session as "${payload.partnerName}"`,
      });
      return NextResponse.json({ ok: true });
    }

    case "CREATE_NOTE": {
      const note = await prisma.noteItem.create({
        data: {
          entityType: payload.entityType,
          entityId: payload.entityId,
          author: session.name || session.email,
          content: payload.content,
          isShared: payload.isShared ?? true,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Note",
        objectId: note.id,
        summary: `Added note on ${payload.entityType} (${payload.entityId})`,
      });
      return NextResponse.json({ ok: true, note });
    }

    case "SAVE_SETTING": {
      if (payload.key === "smtp_config") {
        return NextResponse.json(
          {
            error:
              "SMTP credentials come from environment variables only (EMAIL_DRIVER, SMTP_HOST, SMTP_USER, SMTP_PASS) and are never stored in the database.",
          },
          { status: 400 }
        );
      }
      const setting = await prisma.appSetting.upsert({
        where: { key: payload.key },
        update: {
          valueJson: JSON.stringify(payload.value),
          updatedAt: new Date(),
        },
        create: {
          key: payload.key,
          valueJson: JSON.stringify(payload.value),
        },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "AppSetting",
        objectId: payload.key,
        summary: `Updated workspace setting "${payload.key}"`,
      });
      return NextResponse.json({ ok: true, setting });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
