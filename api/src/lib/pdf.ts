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
  profitPct: number | null;
}

export interface AnnualSummaryProjectLine {
  name: string;
  status: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  profitPct: number | null;
}

export interface AnnualSummaryData {
  year: number;
  contractorName: string;
  generatedAt: string;
  projects: AnnualSummaryProjectLine[];
  overheadCents: number;
  grandNetCents: number;
}

export interface DetailedTxLine {
  date: string;
  type: "DEBIT" | "CREDIT";
  categoryName: string;
  amountCents: number;
  description: string | null;
}

export interface AnnualDetailedData {
  year: number;
  contractorName: string;
  generatedAt: string;
  projects: { name: string; transactions: DetailedTxLine[] }[];
  overhead: DetailedTxLine[];
}

export interface LedgerLine {
  date: string;
  source: string;
  categoryName: string;
  amountCents: number;
}

export interface AnnualLedgerData {
  year: number;
  contractorName: string;
  generatedAt: string;
  credits: LedgerLine[];
  debits: LedgerLine[];
  totalCredits: number;
  totalDebits: number;
  netCents: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(1)}%`;
}

const MARGIN = 50;
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.82, 0.82, 0.82);

interface Column {
  label: string;
  width: number;
  align?: "left" | "right";
}

// Shared low-level PDF drawing helper: owns the current page/y-cursor and
// handles page breaks so each report builder just describes its content.
class PdfBuilder {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private page!: PDFPage;
  private y = 0;

  static async create(): Promise<PdfBuilder> {
    const b = new PdfBuilder();
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.addPage();
    return b;
  }

  private addPage() {
    this.page = this.doc.addPage(PAGE_SIZE);
    this.y = PAGE_SIZE[1] - MARGIN;
  }

  private ensureSpace(minY = MARGIN + 16) {
    if (this.y < minY) this.addPage();
  }

  heading(text: string, size = 20) {
    this.ensureSpace();
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.bold, color: INK });
    this.y -= size + 8;
  }

  subheading(text: string, size = 13) {
    this.ensureSpace();
    this.y -= 6;
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.bold, color: INK });
    this.y -= size + 6;
  }

  text(str: string, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}) {
    this.ensureSpace();
    const size = opts.size ?? 11;
    this.page.drawText(str, { x: MARGIN, y: this.y, size, font: this.font, color: opts.color ?? MUTED });
    this.y -= size + 5;
  }

  gap(px: number) {
    this.y -= px;
  }

  row(label: string, amount: string, opts: { bold?: boolean } = {}) {
    this.ensureSpace();
    const f = opts.bold ? this.bold : this.font;
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 11, font: f, color: INK });
    const w = f.widthOfTextAtSize(amount, 11);
    this.page.drawText(amount, { x: PAGE_SIZE[0] - MARGIN - w, y: this.y, size: 11, font: f, color: INK });
    this.y -= 17;
  }

  table(columns: Column[], rows: string[][]) {
    this.ensureSpace(MARGIN + 40);
    let x = MARGIN;
    for (const col of columns) {
      this.drawCell(col.label, x, col.width, col.align, true);
      x += col.width;
    }
    this.y -= 14;
    const tableWidth = columns.reduce((s, c) => s + c.width, 0);
    this.page.drawLine({ start: { x: MARGIN, y: this.y + 5 }, end: { x: MARGIN + tableWidth, y: this.y + 5 }, thickness: 0.5, color: RULE });
    this.y -= 4;

    if (rows.length === 0) {
      this.text("None", { size: 10 });
      return;
    }

    for (const rowCells of rows) {
      this.ensureSpace();
      x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        this.drawCell(rowCells[i] ?? "", x, columns[i].width, columns[i].align, false);
        x += columns[i].width;
      }
      this.y -= 15;
    }
  }

  private drawCell(text: string, x: number, width: number, align: "left" | "right" = "left", bold = false) {
    const f = bold ? this.bold : this.font;
    const size = 9.5;
    const textWidth = f.widthOfTextAtSize(text, size);
    const drawX = align === "right" ? x + width - textWidth : x;
    this.page.drawText(text, { x: drawX, y: this.y, size, font: f, color: bold ? INK : rgb(0.2, 0.2, 0.2) });
  }

  save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function buildProjectReportPdf(data: ReportData): Promise<Uint8Array> {
  const b = await PdfBuilder.create();

  b.heading(data.projectName);
  b.text(`Contractor: ${data.contractorName}`);
  const range = data.dateFrom || data.dateTo ? `${data.dateFrom ?? "Start"} – ${data.dateTo ?? "Present"}` : "All time";
  b.text(`Date range: ${range}`);
  b.text(`Generated: ${data.generatedAt}`);
  b.gap(12);

  b.subheading("Credits by Category");
  let totalCredits = 0;
  for (const line of data.credits) {
    b.row(line.categoryName, formatCents(line.subtotalCents));
    totalCredits += line.subtotalCents;
  }
  b.row("Total Credits", formatCents(totalCredits), { bold: true });
  b.gap(12);

  b.subheading("Debits by Category");
  let totalDebits = 0;
  for (const line of data.debits) {
    b.row(line.categoryName, formatCents(line.subtotalCents));
    totalDebits += line.subtotalCents;
  }
  b.row("Total Debits", formatCents(totalDebits), { bold: true });
  b.gap(16);

  b.row("Net Profit", formatCents(data.netCents), { bold: true });
  b.row("Profit %", formatPct(data.profitPct), { bold: true });

  return b.save();
}

export async function buildAnnualSummaryPdf(data: AnnualSummaryData): Promise<Uint8Array> {
  const b = await PdfBuilder.create();

  b.heading(`${data.year} Annual Summary`);
  b.text(`Contractor: ${data.contractorName}`);
  b.text(`Generated: ${data.generatedAt}`);
  b.gap(12);

  b.table(
    [
      { label: "Project", width: 190 },
      { label: "Status", width: 80 },
      { label: "Income", width: 80, align: "right" },
      { label: "Expense", width: 80, align: "right" },
      { label: "Net", width: 80, align: "right" },
      { label: "Profit %", width: 62, align: "right" },
    ],
    data.projects.map((p) => [p.name, p.status, formatCents(p.incomeCents), formatCents(p.expenseCents), formatCents(p.netCents), formatPct(p.profitPct)]),
  );

  b.gap(16);
  b.row("Total Project Net", formatCents(data.projects.reduce((s, p) => s + p.netCents, 0)), { bold: true });
  b.row("Overhead", `(${formatCents(data.overheadCents)})`);
  b.row("Annual Net Profit", formatCents(data.grandNetCents), { bold: true });

  return b.save();
}

export async function buildAnnualDetailedPdf(data: AnnualDetailedData): Promise<Uint8Array> {
  const b = await PdfBuilder.create();

  b.heading(`${data.year} Detailed Expense Report`);
  b.text(`Contractor: ${data.contractorName}`);
  b.text(`Generated: ${data.generatedAt}`);
  b.gap(12);

  const columns: Column[] = [
    { label: "Date", width: 70 },
    { label: "Type", width: 55 },
    { label: "Category", width: 120 },
    { label: "Description", width: 175 },
    { label: "Amount", width: 92, align: "right" },
  ];

  for (const project of data.projects) {
    b.subheading(project.name);
    b.table(
      columns,
      project.transactions.map((t) => [t.date, t.type === "CREDIT" ? "Credit" : "Debit", t.categoryName, t.description ?? "", formatCents(t.amountCents)]),
    );
    b.gap(10);
  }

  if (data.overhead.length > 0) {
    b.subheading("Overhead");
    b.table(
      columns,
      data.overhead.map((t) => [t.date, "Debit", t.categoryName, t.description ?? "", formatCents(t.amountCents)]),
    );
  }

  return b.save();
}

export async function buildAnnualLedgerPdf(data: AnnualLedgerData): Promise<Uint8Array> {
  const b = await PdfBuilder.create();

  b.heading(`${data.year} Annual Ledger`);
  b.text(`Contractor: ${data.contractorName}`);
  b.text(`Generated: ${data.generatedAt}`);
  b.gap(12);

  const columns: Column[] = [
    { label: "Date", width: 70 },
    { label: "Source", width: 170 },
    { label: "Category", width: 150 },
    { label: "Amount", width: 122, align: "right" },
  ];

  b.subheading("Credits by Date");
  b.table(
    columns,
    data.credits.map((l) => [l.date, l.source, l.categoryName, formatCents(l.amountCents)]),
  );
  b.gap(10);

  b.subheading("Debits by Date");
  b.table(
    columns,
    data.debits.map((l) => [l.date, l.source, l.categoryName, formatCents(l.amountCents)]),
  );
  b.gap(16);

  b.row("Total Credits", formatCents(data.totalCredits), { bold: true });
  b.row("Total Debits", formatCents(data.totalDebits), { bold: true });
  b.row("Net Profit", formatCents(data.netCents), { bold: true });

  return b.save();
}
