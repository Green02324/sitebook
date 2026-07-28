import { Router } from "express";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { profitPercent } from "../lib/money";
import { projectAttributedYear } from "../lib/projectYear";
import { OVERHEAD_LABEL } from "../lib/labels";
import {
  buildAnnualSummaryPdf,
  buildAnnualDetailedPdf,
  buildAnnualLedgerPdf,
  type AnnualSummaryData,
  type AnnualDetailedData,
  type AnnualLedgerData,
  type DetailedTxLine,
  type LedgerLine,
} from "../lib/pdf";

const router = Router();
router.use(requireAuth, withEffectiveUser);

// The date column is nullable because estimates are planned by phase instead.
// Everything in these reports is mode ACTUAL, which the API always requires a
// date for, so the fallback here is unreachable in practice.
function dateOnly(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function yearRange(req: Request): { year: number; yearStart: Date; yearEnd: Date } {
  const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
  return { year, yearStart: new Date(Date.UTC(year, 0, 1)), yearEnd: new Date(Date.UTC(year + 1, 0, 1)) };
}

async function contractorName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.name ?? "Unknown";
}

async function buildSummary(userId: string, req: Request): Promise<AnnualSummaryData> {
  const { year, yearStart, yearEnd } = yearRange(req);

  // A project belongs to a single year (its completion/target year); once
  // in scope, ALL of its transactions count — not just ones dated within
  // this calendar year — matching the dashboard's attribution model.
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { transactions: { where: { mode: "ACTUAL" }, select: { type: true, amountCents: true } } },
  });
  const projectsThisYear = projects.filter((p) => projectAttributedYear(p) === year);

  const projectLines = projectsThisYear.map((p) => {
    let incomeCents = 0;
    let expenseCents = 0;
    for (const tx of p.transactions) {
      if (tx.type === "CREDIT") incomeCents += tx.amountCents;
      else expenseCents += tx.amountCents;
    }
    return {
      name: p.name,
      status: p.status,
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      profitPct: profitPercent(incomeCents, expenseCents),
    };
  });

  const overheadTotal = await prisma.overheadExpense.aggregate({
    where: { userId, date: { gte: yearStart, lt: yearEnd } },
    _sum: { amountCents: true },
  });
  const overheadCents = overheadTotal._sum.amountCents ?? 0;
  const grandNetCents = projectLines.reduce((s, p) => s + p.netCents, 0) - overheadCents;

  return { year, contractorName: await contractorName(userId), generatedAt: new Date().toISOString().slice(0, 10), projects: projectLines, overheadCents, grandNetCents };
}

async function buildDetailed(userId: string, req: Request): Promise<AnnualDetailedData> {
  const { year, yearStart, yearEnd } = yearRange(req);

  const allProjects = await prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const projects = allProjects.filter((p) => projectAttributedYear(p) === year);
  const projectLines = await Promise.all(
    projects.map(async (p) => {
      const transactions = await prisma.transaction.findMany({
        where: { projectId: p.id, mode: "ACTUAL" },
        include: { category: true },
        orderBy: { date: "asc" },
      });
      const lines: DetailedTxLine[] = transactions.map((t) => ({
        date: dateOnly(t.date),
        type: t.type,
        categoryName: t.category?.name ?? "Uncategorized",
        amountCents: t.amountCents,
        description: t.description,
      }));
      return { name: p.name, transactions: lines };
    }),
  );

  const overheadExpenses = await prisma.overheadExpense.findMany({
    where: { userId, date: { gte: yearStart, lt: yearEnd } },
    include: { category: true },
    orderBy: { date: "asc" },
  });
  const overheadLines: DetailedTxLine[] = overheadExpenses.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    type: "DEBIT",
    categoryName: e.category?.name ?? "Uncategorized",
    amountCents: e.amountCents,
    description: e.description,
  }));

  return { year, contractorName: await contractorName(userId), generatedAt: new Date().toISOString().slice(0, 10), projects: projectLines, overhead: overheadLines };
}

async function buildLedger(userId: string, req: Request): Promise<AnnualLedgerData> {
  const { year, yearStart, yearEnd } = yearRange(req);

  const transactions = await prisma.transaction.findMany({
    where: { mode: "ACTUAL", date: { gte: yearStart, lt: yearEnd }, project: { userId } },
    include: { category: true, project: true },
    orderBy: { date: "asc" },
  });

  const credits: LedgerLine[] = [];
  const debits: LedgerLine[] = [];
  for (const tx of transactions) {
    const line: LedgerLine = {
      date: dateOnly(tx.date),
      source: tx.project.name,
      categoryName: tx.category?.name ?? "Uncategorized",
      amountCents: tx.amountCents,
    };
    if (tx.type === "CREDIT") credits.push(line);
    else debits.push(line);
  }

  const overheadExpenses = await prisma.overheadExpense.findMany({
    where: { userId, date: { gte: yearStart, lt: yearEnd } },
    include: { category: true },
    orderBy: { date: "asc" },
  });
  for (const e of overheadExpenses) {
    debits.push({ date: e.date.toISOString().slice(0, 10), source: OVERHEAD_LABEL, categoryName: e.category?.name ?? "Uncategorized", amountCents: e.amountCents });
  }
  debits.sort((a, b) => a.date.localeCompare(b.date));

  const totalCredits = credits.reduce((s, l) => s + l.amountCents, 0);
  const totalDebits = debits.reduce((s, l) => s + l.amountCents, 0);

  return {
    year,
    contractorName: await contractorName(userId),
    generatedAt: new Date().toISOString().slice(0, 10),
    credits,
    debits,
    totalCredits,
    totalDebits,
    netCents: totalCredits - totalDebits,
  };
}

router.get(
  "/annual/summary",
  ah(async (req, res) => res.json(await buildSummary(req.effectiveUserId!, req))),
);
router.get(
  "/annual/summary/pdf",
  ah(async (req, res) => {
    const data = await buildSummary(req.effectiveUserId!, req);
    const pdfBytes = await buildAnnualSummaryPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${data.year}-annual-summary.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.get(
  "/annual/detailed",
  ah(async (req, res) => res.json(await buildDetailed(req.effectiveUserId!, req))),
);
router.get(
  "/annual/detailed/pdf",
  ah(async (req, res) => {
    const data = await buildDetailed(req.effectiveUserId!, req);
    const pdfBytes = await buildAnnualDetailedPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${data.year}-annual-detailed.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.get(
  "/annual/ledger",
  ah(async (req, res) => res.json(await buildLedger(req.effectiveUserId!, req))),
);
router.get(
  "/annual/ledger/pdf",
  ah(async (req, res) => {
    const data = await buildLedger(req.effectiveUserId!, req);
    const pdfBytes = await buildAnnualLedgerPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${data.year}-annual-ledger.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

export default router;
