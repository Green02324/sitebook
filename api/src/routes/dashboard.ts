import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { projectAttributedYear } from "../lib/projectYear";

const router = Router();
router.use(requireAuth, withEffectiveUser);

router.get(
  "/",
  ah(async (req, res) => {
    const userId = req.effectiveUserId!;
    const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    // Each project belongs to a single year (its completion/target year) —
    // once a job is in scope for that year, ALL of its transactions count,
    // regardless of which actual calendar year they landed in. A job's cost
    // basis isn't split across the years it happened to span.
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { transactions: { where: { mode: "ACTUAL" }, select: { type: true, amountCents: true } } },
    });

    const projectsThisYear = projects.filter((p) => projectAttributedYear(p) === year);

    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    const projectSummaries = projectsThisYear.map((p) => {
      let incomeCents = 0;
      let expenseCents = 0;
      for (const tx of p.transactions) {
        if (tx.type === "CREDIT") incomeCents += tx.amountCents;
        else expenseCents += tx.amountCents;
      }
      totalIncomeCents += incomeCents;
      totalExpenseCents += expenseCents;
      return { id: p.id, name: p.name, status: p.status, createdAt: p.createdAt, incomeCents, expenseCents, netCents: incomeCents - expenseCents };
    });

    // Overhead has no project lifecycle to attribute to, so it stays
    // scoped by its own expense date within the selected calendar year.
    const overheadTotal = await prisma.overheadExpense.aggregate({
      where: { userId, date: { gte: yearStart, lt: yearEnd } },
      _sum: { amountCents: true },
    });
    const overheadCents = overheadTotal._sum.amountCents ?? 0;

    const availableYearsSet = new Set(projects.map(projectAttributedYear));
    availableYearsSet.add(year);
    const availableYears = Array.from(availableYearsSet).sort((a, b) => b - a);

    res.json({ year, totalIncomeCents, totalExpenseCents, overheadCents, projects: projectSummaries, availableYears });
  }),
);

// Lazily-loaded drill-down for the dashboard donut: a project's all-time
// debit-by-category breakdown (no credits — the donut only ever shows cost),
// or the same shape for overhead (still scoped to the selected year, since
// overhead expenses are just dated line items, not projects).
router.get(
  "/breakdown",
  ah(async (req, res) => {
    const userId = req.effectiveUserId!;
    const { projectId, overhead } = req.query as { projectId?: string; overhead?: string };

    if (overhead === "true") {
      const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
      const expenses = await prisma.overheadExpense.findMany({
        where: { userId, date: { gte: yearStart, lt: yearEnd } },
        include: { category: true },
      });
      const byCategory = new Map<string, number>();
      for (const e of expenses) {
        const name = e.category?.name ?? "Uncategorized";
        byCategory.set(name, (byCategory.get(name) ?? 0) + e.amountCents);
      }
      res.json({ debits: Array.from(byCategory.entries()).map(([name, amountCents]) => ({ name, amountCents })) });
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
      where: { projectId, mode: "ACTUAL", type: "DEBIT" },
      include: { category: true },
    });
    const byCategory = new Map<string, number>();
    for (const tx of transactions) {
      const name = tx.category?.name ?? "Uncategorized";
      byCategory.set(name, (byCategory.get(name) ?? 0) + tx.amountCents);
    }
    res.json({ debits: Array.from(byCategory.entries()).map(([name, amountCents]) => ({ name, amountCents })) });
  }),
);

export default router;
