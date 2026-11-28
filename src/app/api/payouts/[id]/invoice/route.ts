import { NextRequest, NextResponse } from "next/server";
import { getActiveServerSession } from "@/lib/authSession";
import { prisma } from "@/lib/prisma";
import { buildSelfInvoicePdf } from "@/lib/selfInvoicePdf";

export const dynamic = "force-dynamic";

/** Self-billed invoice PDF for one payout. Coworkers: any payout. Partner users: their own payouts only. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const payout = await prisma.payout.findUnique({
    where: { id: params.id },
    include: { rewards: { orderBy: { createdAt: "asc" } } },
  });
  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }
  if (session.identityType === "partner" && session.partnerName !== payout.partnerName) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const acctRow = await prisma.appSetting.findUnique({ where: { key: "account_settings" } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let acct: any = {};
  try {
    acct = acctRow ? JSON.parse(acctRow.valueJson) : {};
  } catch {
    acct = {};
  }
  if (!acct.selfInvoicingEnabled) {
    return NextResponse.json(
      { error: "Self-invoicing is turned off. Turn it on in Account Settings → Payout settings." },
      { status: 409 }
    );
  }
  const mixed = payout.rewards.some(
    (r) => r.currency !== payout.currency && payout.currency !== acct.mainCurrency
  );
  if (mixed) {
    return NextResponse.json(
      { error: "This payout mixes currencies that can't be converted for the invoice." },
      { status: 409 }
    );
  }
  const partner = await prisma.partner.findFirst({ where: { name: payout.partnerName } });

  const pdf = await buildSelfInvoicePdf({
    invoiceRef: payout.invoiceRef || payout.payoutNumber,
    payoutNumber: payout.payoutNumber,
    issueDate: (payout.paidDate || payout.createdAt.toISOString()).slice(0, 10),
    periodFrom: payout.periodFrom,
    periodTo: payout.periodTo,
    currency: payout.currency,
    partner: { name: payout.partnerName, address: partner?.companyAddress || "" },
    customer: {
      legalName: acct.legalEntityName || acct.accountName || "Workspace",
      address: acct.billingAddress || "",
      taxId: acct.taxId || "",
    },
    lines: payout.rewards.map((r) => ({
      reference: r.rewardNumber,
      description: [r.fromRewardRule, r.fromActivity].filter(Boolean).join(" · "),
      amountMinor: r.currency === payout.currency ? r.amount : r.amountBase,
    })),
  });

  await prisma.auditLog.create({
    data: {
      actor: session.email,
      actorRole: `${session.identityType} (${session.role})`,
      action: "EXPORT",
      objectType: "Payout",
      objectId: payout.id,
      summary: `Downloaded self-billed invoice ${payout.invoiceRef || payout.payoutNumber}`,
    },
  });

  const fileName = `${(payout.invoiceRef || payout.payoutNumber).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
