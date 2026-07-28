import { Router } from "express";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { buildProjectReportPdf, buildEstimatePdf, buildComparisonPdf, type ReportData } from "../lib/pdf";
import { profitPercent } from "../lib/money";
import categoriesRouter from "./categories";
import transactionsRouter from "./transactions";
import type { Prisma, ProjectStatus } from "@prisma/client";

interface ProjectFieldsInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  address?: string | null;
  startDate?: string | null;
  targetCompletionDate?: string | null;
  contractAmountCents?: number | null;
}

const router = Router();
router.use(requireAuth, withEffectiveUser);

router.param("id", (req, res, next, id) => {
  prisma.project
    .findFirst({ where: { id, userId: req.effectiveUserId } })
    .then((project) => {
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      req.project = project;
      next();
    })
    .catch(next);
});

router.get(
  "/",
  ah(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { userId: req.effectiveUserId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { transactions: true } } },
    });
    res.json(projects);
  }),
);

router.post(
  "/",
  ah(async (req, res) => {
    const body = req.body as ProjectFieldsInput;
    if (!body.name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        status: body.status ?? "PLANNING",
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        clientEmail: body.clientEmail,
        address: body.address,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : undefined,
        contractAmountCents: body.contractAmountCents ?? undefined,
        userId: req.user!.id,
      },
    });
    res.status(201).json(project);
  }),
);

router.get("/:id", (req, res) => {
  res.json(req.project);
});

router.put(
  "/:id",
  ah(async (req, res) => {
    const body = req.body as ProjectFieldsInput;
    const data: Prisma.ProjectUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.status !== undefined) data.status = body.status;
    if (body.clientName !== undefined) data.clientName = body.clientName;
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone;
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail;
    if (body.address !== undefined) data.address = body.address;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.targetCompletionDate !== undefined) data.targetCompletionDate = body.targetCompletionDate ? new Date(body.targetCompletionDate) : null;
    if (body.contractAmountCents !== undefined) data.contractAmountCents = body.contractAmountCents;
    const project = await prisma.project.update({ where: { id: req.project!.id }, data });
    res.json(project);
  }),
);

router.delete(
  "/:id",
  ah(async (req, res) => {
    await prisma.project.delete({ where: { id: req.project!.id } });
    res.status(204).end();
  }),
);

router.get(
  "/:id/report",
  ah(async (req, res) => {
    const report = await buildReportData(req);
    res.json(report);
  }),
);

router.get(
  "/:id/report/pdf",
  ah(async (req, res) => {
    const report = await buildReportData(req, req.query.detailed === "true");
    const pdfBytes = await buildProjectReportPdf(report);
    const safeName = req.project!.name.replace(/[^a-z0-9-_ ]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-report.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.get(
  "/:id/estimate/pdf",
  ah(async (req, res) => {
    const transactions = await prisma.transaction.findMany({
      where: { projectId: req.project!.id, mode: "ESTIMATE" },
      include: { category: true },
      orderBy: [{ sortOrder: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });

    const toLine = (t: (typeof transactions)[number]) => ({
      phase: t.phase,
      categoryName: t.category?.name ?? "Uncategorized",
      description: t.description,
      amountCents: t.amountCents,
    });
    const debits = transactions.filter((t) => t.type === "DEBIT").map(toLine);
    const credits = transactions.filter((t) => t.type === "CREDIT").map(toLine);
    const owner = await prisma.user.findUnique({ where: { id: req.project!.userId } });

    const pdfBytes = await buildEstimatePdf({
      projectName: req.project!.name,
      contractorName: owner?.name ?? "Unknown",
      clientName: req.project!.clientName,
      address: req.project!.address,
      generatedAt: new Date().toISOString().slice(0, 10),
      debits,
      credits,
      totalDebitCents: debits.reduce((s, l) => s + l.amountCents, 0),
      totalCreditCents: credits.reduce((s, l) => s + l.amountCents, 0),
    });

    const safeName = req.project!.name.replace(/[^a-z0-9-_ ]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-estimate.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.get(
  "/:id/comparison/pdf",
  ah(async (req, res) => {
    const rows = await buildComparisonRows(req.project!.id);
    const owner = await prisma.user.findUnique({ where: { id: req.project!.userId } });

    const pdfBytes = await buildComparisonPdf({
      projectName: req.project!.name,
      contractorName: owner?.name ?? "Unknown",
      generatedAt: new Date().toISOString().slice(0, 10),
      rows,
      totalEstimateDebitCents: rows.reduce((s, r) => s + r.estimateDebitCents, 0),
      totalActualDebitCents: rows.reduce((s, r) => s + r.actualDebitCents, 0),
      totalEstimateCreditCents: rows.reduce((s, r) => s + r.estimateCreditCents, 0),
      totalActualCreditCents: rows.reduce((s, r) => s + r.actualCreditCents, 0),
    });

    const safeName = req.project!.name.replace(/[^a-z0-9-_ ]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-comparison.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

// Phases a project has actually used, so the estimate form can offer them
// back without maintaining a separate list to keep in sync.
router.get(
  "/:id/phases",
  ah(async (req, res) => {
    const rows = await prisma.transaction.findMany({
      where: { projectId: req.project!.id, phase: { not: null } },
      distinct: ["phase"],
      select: { phase: true },
      orderBy: { phase: "asc" },
    });
    res.json(rows.map((r) => r.phase).filter((p): p is string => Boolean(p)));
  }),
);

// Shared by the comparison tab and its PDF, so the printed sheet can never
// drift from what's on screen.
async function buildComparisonRows(projectId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { projectId },
    include: { category: true },
  });

  type Row = {
    categoryId: string | null;
    categoryName: string;
    estimateDebitCents: number;
    estimateCreditCents: number;
    actualDebitCents: number;
    actualCreditCents: number;
  };
  const rows = new Map<string, Row>();

  for (const tx of transactions) {
    const key = tx.categoryId ?? "uncategorized";
    const row: Row = rows.get(key) ?? {
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? "Uncategorized",
      estimateDebitCents: 0,
      estimateCreditCents: 0,
      actualDebitCents: 0,
      actualCreditCents: 0,
    };
    const field = `${tx.mode === "ESTIMATE" ? "estimate" : "actual"}${tx.type === "DEBIT" ? "Debit" : "Credit"}Cents` as
      | "estimateDebitCents"
      | "estimateCreditCents"
      | "actualDebitCents"
      | "actualCreditCents";
    row[field] += tx.amountCents;
    rows.set(key, row);
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    varianceDebitCents: row.actualDebitCents - row.estimateDebitCents,
    varianceCreditCents: row.actualCreditCents - row.estimateCreditCents,
  }));
}

router.get(
  "/:id/comparison",
  ah(async (req, res) => {
    res.json(await buildComparisonRows(req.project!.id));
  }),
);

async function buildReportData(req: Request, detailed = false): Promise<ReportData> {
  const projectId = req.project!.id;
  const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };

  const where: Prisma.TransactionWhereInput = { projectId, mode: "ACTUAL" };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const transactions = await prisma.transaction.findMany({ where, include: { category: true } });

  const creditsByCategory = new Map<string, number>();
  const debitsByCategory = new Map<string, number>();
  for (const tx of transactions) {
    const name = tx.category?.name ?? "Uncategorized";
    const map = tx.type === "CREDIT" ? creditsByCategory : debitsByCategory;
    map.set(name, (map.get(name) ?? 0) + tx.amountCents);
  }

  const credits = Array.from(creditsByCategory.entries()).map(([categoryName, subtotalCents]) => ({ categoryName, subtotalCents }));
  const debits = Array.from(debitsByCategory.entries()).map(([categoryName, subtotalCents]) => ({ categoryName, subtotalCents }));
  const totalCreditCents = credits.reduce((s, c) => s + c.subtotalCents, 0);
  const totalDebitCents = debits.reduce((s, d) => s + d.subtotalCents, 0);
  const netCents = totalCreditCents - totalDebitCents;

  const owner = await prisma.user.findUnique({ where: { id: req.project!.userId } });

  return {
    projectName: req.project!.name,
    contractorName: owner?.name ?? "Unknown",
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
    transactions: detailed
      ? [...transactions]
          .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
          .map((t) => ({
            date: t.date ? t.date.toISOString().slice(0, 10) : "",
            type: t.type,
            categoryName: t.category?.name ?? "Uncategorized",
            description: t.description,
            amountCents: t.amountCents,
          }))
      : undefined,
    generatedAt: new Date().toISOString().slice(0, 10),
    credits,
    debits,
    netCents,
    profitPct: profitPercent(totalCreditCents, totalDebitCents),
  };
}

router.use("/:id/categories", categoriesRouter);
router.use("/:id/transactions", transactionsRouter);

export default router;
