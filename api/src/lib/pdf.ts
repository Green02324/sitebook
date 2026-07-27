import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

export interface ReportLine {
  categoryName: string;
  subtotalCents: number;
}

export interface ReportData {
  projectName: string;
  contractorName: string;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  credits: ReportLine[];
  debits: ReportLine[];
  netCents: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MARGIN = 50;
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter

export async function buildProjectReportPdf(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  const newPageIfNeeded = () => {
    if (y < MARGIN + 20) {
      page = doc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  };

  const drawLine = (text: string, opts: { font?: PDFFont; size?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}) => {
    newPageIfNeeded();
    page.drawText(text, {
      x: MARGIN,
      y,
      size: opts.size ?? 11,
      font: opts.font ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
    y -= opts.gap ?? (opts.size ?? 11) + 6;
  };

  const drawRow = (label: string, amount: string, opts: { bold?: boolean } = {}) => {
    newPageIfNeeded();
    const useFont = opts.bold ? bold : font;
    page.drawText(label, { x: MARGIN, y, size: 11, font: useFont, color: rgb(0.1, 0.1, 0.1) });
    const amountWidth = useFont.widthOfTextAtSize(amount, 11);
    page.drawText(amount, { x: PAGE_SIZE[0] - MARGIN - amountWidth, y, size: 11, font: useFont, color: rgb(0.1, 0.1, 0.1) });
    y -= 17;
  };

  drawLine(data.projectName, { font: bold, size: 20, gap: 28 });
  drawLine(`Contractor: ${data.contractorName}`, { size: 11 });
  const range = data.dateFrom || data.dateTo ? `${data.dateFrom ?? "Start"} – ${data.dateTo ?? "Present"}` : "All time";
  drawLine(`Date range: ${range}`, { size: 11 });
  drawLine(`Generated: ${data.generatedAt}`, { size: 11, gap: 24 });

  drawLine("Credits by Category", { font: bold, size: 13, gap: 20 });
  let totalCredits = 0;
  for (const line of data.credits) {
    drawRow(line.categoryName, formatCents(line.subtotalCents));
    totalCredits += line.subtotalCents;
  }
  drawRow("Total Credits", formatCents(totalCredits), { bold: true });
  y -= 12;

  drawLine("Debits by Category", { font: bold, size: 13, gap: 20 });
  let totalDebits = 0;
  for (const line of data.debits) {
    drawRow(line.categoryName, formatCents(line.subtotalCents));
    totalDebits += line.subtotalCents;
  }
  drawRow("Total Debits", formatCents(totalDebits), { bold: true });
  y -= 20;

  drawRow("Net Profit", formatCents(data.netCents), { bold: true });

  return doc.save();
}
