import { Router } from "express";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { buildProjectReportPdf, type ReportData } from "../lib/pdf";
import categoriesRouter from "./categories";
import transactionsRouter from "./transactions";
import type { Prisma, ProjectStatus } from "@prisma/client";

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
    const { name, description, status } = req.body as { name?: string; description?: string; status?: ProjectStatus };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const project = await prisma.project.create({
      data: { name, description, status: status ?? "PLANNING", userId: req.user!.id },
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
    const { name, description, status } = req.body as { name?: string; description?: string; status?: ProjectStatus };
    const data: Prisma.ProjectUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
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
    const report = await buildReportData(req);
    const pdfBytes = await buildProjectReportPdf(report);
    const safeName = req.project!.name.replace(/[^a-z0-9-_ ]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-report.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.get(
  "/:id/comparison",
  ah(async (req, res) => {
    const projectId = req.project!.id;
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

    const result = Array.from(rows.values()).map((row) => ({
      ...row,
      varianceDebitCents: row.actualDebitCents - row.estimateDebitCents,
      varianceCreditCents: row.actualCreditCents - row.estimateCreditCents,
    }));

    res.json(result);
  }),
);

async function buildReportData(req: Request): Promise<ReportData> {
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
  const netCents = credits.reduce((s, c) => s + c.subtotalCents, 0) - debits.reduce((s, d) => s + d.subtotalCents, 0);

  const owner = await prisma.user.findUnique({ where: { id: req.project!.userId } });

  return {
    projectName: req.project!.name,
    contractorName: owner?.name ?? "Unknown",
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
    generatedAt: new Date().toISOString().slice(0, 10),
    credits,
    debits,
    netCents,
  };
}

router.use("/:id/categories", categoriesRouter);
router.use("/:id/transactions", transactionsRouter);

export default router;
