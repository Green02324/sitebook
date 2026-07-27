import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";

const router = Router();
router.use(requireAuth, withEffectiveUser);

router.get(
  "/",
  ah(async (req, res) => {
    const userId = req.effectiveUserId!;
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true, createdAt: true },
    });

    const transactions = await prisma.transaction.findMany({
      where: {
        mode: "ACTUAL",
        date: { gte: yearStart, lt: yearEnd },
        project: { userId },
      },
      select: { type: true, amountCents: true, projectId: true },
    });

    const byProject = new Map<string, { incomeCents: number; expenseCents: number }>();
    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    for (const tx of transactions) {
      const bucket = byProject.get(tx.projectId) ?? { incomeCents: 0, expenseCents: 0 };
      if (tx.type === "CREDIT") {
        bucket.incomeCents += tx.amountCents;
        totalIncomeCents += tx.amountCents;
      } else {
        bucket.expenseCents += tx.amountCents;
        totalExpenseCents += tx.amountCents;
      }
      byProject.set(tx.projectId, bucket);
    }

    const projectSummaries = projects.map((p) => {
      const bucket = byProject.get(p.id) ?? { incomeCents: 0, expenseCents: 0 };
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt,
        incomeCents: bucket.incomeCents,
        expenseCents: bucket.expenseCents,
        netCents: bucket.incomeCents - bucket.expenseCents,
      };
    });

    const overheadTotal = await prisma.overheadExpense.aggregate({
      where: { userId, date: { gte: yearStart, lt: yearEnd } },
      _sum: { amountCents: true },
    });
    const overheadCents = overheadTotal._sum.amountCents ?? 0;

    const yearRows = await prisma.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM t.date)::int AS year
      FROM "Transaction" t
      JOIN "Project" p ON p.id = t."projectId"
      WHERE p."userId" = ${userId}
      ORDER BY year DESC
    `;
    const availableYears = yearRows.map((r) => r.year);
    if (!availableYears.includes(year)) availableYears.unshift(year);

    res.json({ year, totalIncomeCents, totalExpenseCents, overheadCents, projects: projectSummaries, availableYears });
  }),
);

// Lazily-loaded drill-down for the dashboard donut: either a single
// project's actual credit total + debit-by-category breakdown, or the
// same shape for overhead (which has no credits, only debits).
router.get(
  "/breakdown",
  ah(async (req, res) => {
    const userId = req.effectiveUserId!;
    const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const { projectId, overhead } = req.query as { projectId?: string; overhead?: string };

    if (overhead === "true") {
      const expenses = await prisma.overheadExpense.findMany({
        where: { userId, date: { gte: yearStart, lt: yearEnd } },
        include: { category: true },
      });
      const byCategory = new Map<string, number>();
      for (const e of expenses) {
        const name = e.category?.name ?? "Uncategorized";
        byCategory.set(name, (byCategory.get(name) ?? 0) + e.amountCents);
      }
      res.json({ creditCents: 0, debits: Array.from(byCategory.entries()).map(([name, amountCents]) => ({ name, amountCents })) });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: "projectId or overhead=true is required" });
      return;
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const transactions = await prisma.transaction.findMany({
      where: { projectId, mode: "ACTUAL", date: { gte: yearStart, lt: yearEnd } },
      include: { category: true },
    });
    let creditCents = 0;
    const byCategory = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === "CREDIT") {
        creditCents += tx.amountCents;
      } else {
        const name = tx.category?.name ?? "Uncategorized";
        byCategory.set(name, (byCategory.get(name) ?? 0) + tx.amountCents);
      }
    }
    res.json({ creditCents, debits: Array.from(byCategory.entries()).map(([name, amountCents]) => ({ name, amountCents })) });
  }),
);

export default router;
