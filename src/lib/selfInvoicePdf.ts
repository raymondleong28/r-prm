import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Builds a self-billed invoice PDF for a payout: the partner is the supplier,
// the workspace's legal entity is the customer, one line per bundled reward.

export type SelfInvoiceInput = {
  invoiceRef: string;
  payoutNumber: string;
  issueDate: string;
  periodFrom: string;
  periodTo: string;
  currency: string;
  partner: { name: string; address: string };
  customer: { legalName: string; address: string; taxId: string };
  lines: Array<{ reference: string; description: string; amountMinor: number }>;
};

export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${currency} ${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Standard PDF fonts only cover WinAnsi; replace anything else so generation never fails.
function safe(text: string): string {
  return (text || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildSelfInvoicePdf(input: SelfInvoiceInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Self-billed invoice ${input.invoiceRef}`);
  pdf.setCreator("R-PRM");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.4, 0.45, 0.5);
  const dark = rgb(0.1, 0.12, 0.15);
  const margin = 50;
  const width = 595.28;
  const height = 841.89;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;

  const text = (t: string, x: number, size = 10, f: PDFFont = font, color = dark) => {
    page.drawText(safe(t), { x, y, size, font: f, color });
  };
  const newPageIfNeeded = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
  };

  text("SELF-BILLED INVOICE", margin, 18, bold);
  y -= 22;
  text(`Invoice ${input.invoiceRef}  ·  Payout ${input.payoutNumber}`, margin, 10, font, grey);
  y -= 14;
  text(`Issue date ${input.issueDate}  ·  Period ${input.periodFrom || "—"} to ${input.periodTo || "—"}`, margin, 10, font, grey);
  y -= 30;

  const colX = [margin, width / 2 + 10];
  const blockTop = y;
  const block = (x: number, title: string, rows: string[]) => {
    y = blockTop;
    text(title, x, 9, bold, grey);
    y -= 14;
    for (const row of rows) {
      for (const line of wrap(row, font, 10, width / 2 - margin - 20)) {
        text(line, x, 10);
        y -= 13;
      }
    }
    return y;
  };
  const yA = block(colX[0], "SUPPLIER (PARTNER)", [input.partner.name, input.partner.address || "Address not provided"]);
  const yB = block(colX[1], "CUSTOMER", [
    input.customer.legalName,
    input.customer.address || "Address not configured",
    input.customer.taxId ? `Tax ID ${input.customer.taxId}` : "",
  ].filter(Boolean));
  y = Math.min(yA, yB) - 24;

  page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 18, color: rgb(0.94, 0.96, 0.98) });
  text("Reference", margin + 6, 9, bold);
  text("Description", margin + 110, 9, bold);
  text("Amount", width - margin - 90, 9, bold);
  y -= 22;

  let total = 0;
  for (const line of input.lines) {
    const desc = wrap(line.description || "Partner reward", font, 9, width - 2 * margin - 220);
    newPageIfNeeded(desc.length * 12 + 6);
    text(line.reference, margin + 6, 9);
    text(formatMoney(line.amountMinor, input.currency), width - margin - 90, 9);
    for (const d of desc) {
      text(d, margin + 110, 9);
      y -= 12;
    }
    y -= 4;
    total += line.amountMinor;
  }
  if (input.lines.length === 0) {
    text("No rewards are linked to this payout.", margin + 6, 9, font, grey);
    y -= 16;
  }

  newPageIfNeeded(60);
  y -= 6;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.5, color: grey });
  text("Total", width - margin - 170, 11, bold);
  text(formatMoney(total, input.currency), width - margin - 90, 11, bold);
  y -= 36;
  for (const line of wrap(
    `This invoice was issued by ${input.customer.legalName} on behalf of ${input.partner.name} under the partner's self-billing agreement. Amounts are calculated from the rewards listed above.`,
    font,
    8,
    width - 2 * margin
  )) {
    text(line, margin, 8, font, grey);
    y -= 11;
  }

  return pdf.save();
}
