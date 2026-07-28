import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { assertPositiveCents } from "../lib/money";
import { buildOverheadPdf } from "../lib/pdf";
import type { Prisma } from "@prisma/client";

const router = Router();
router.use(requireAuth, withEffectiveUser);

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

router.get(
  "/categories",
  ah(async (req, res) => {
    const categories = await prisma.overheadCategory.findMany({
      where: { userId: req.effectiveUserId },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  }),
);

router.post(
  "/categories",
  ah(async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    try {
      const category = await prisma.overheadCategory.create({ data: { name, userId: req.user!.id } });
      res.status(201).json(category);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Category already exists" });
        return;
      }
      throw err;
    }
  }),
);

router.put(
  "/categories/:catId",
  ah(async (req, res) => {
    const existing = await prisma.overheadCategory.findFirst({ where: { id: req.params.catId, userId: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    try {
      const category = await prisma.overheadCategory.update({ where: { id: existing.id }, data: { name } });
      res.json(category);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Category already exists" });
        return;
      }
      throw err;
    }
  }),
);

router.delete(
  "/categories/:catId",
  ah(async (req, res) => {
    const existing = await prisma.overheadCategory.findFirst({ where: { id: req.params.catId, userId: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const inUse = await prisma.overheadExpense.count({ where: { categoryId: existing.id } });
    if (inUse > 0) {
      res.status(409).json({ error: "Cannot delete a category that has expenses" });
      return;
    }
    await prisma.overheadCategory.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

router.get(
  "/",
  ah(async (req, res) => {
    const { year, categoryId } = req.query as { year?: string; categoryId?: string };
    const where: Prisma.OverheadExpenseWhereInput = { userId: req.effectiveUserId };
    if (year) {
      where.date = { gte: new Date(Date.UTC(Number(year), 0, 1)), lt: new Date(Date.UTC(Number(year) + 1, 0, 1)) };
    }
    if (categoryId) where.categoryId = categoryId;
    const expenses = await prisma.overheadExpense.findMany({ where, orderBy: { date: "desc" }, include: { category: true } });
    res.json(expenses);
  }),
);

router.get(
  "/pdf",
  ah(async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
    const expenses = await prisma.overheadExpense.findMany({
      where: {
        userId: req.effectiveUserId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      orderBy: { date: "asc" },
      include: { category: true },
    });
    const owner = await prisma.user.findUnique({ where: { id: req.effectiveUserId! } });

    const pdfBytes = await buildOverheadPdf({
      year,
      contractorName: owner?.name ?? "Unknown",
      generatedAt: new Date().toISOString().slice(0, 10),
      expenses: expenses.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        categoryName: e.category?.name ?? "Uncategorized",
        description: e.description,
        amountCents: e.amountCents,
      })),
      totalCents: expenses.reduce((s, e) => s + e.amountCents, 0),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${year}-operating-expenses.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

router.post(
  "/",
  ah(async (req, res) => {
    const { date, amountCents, categoryId, description, notes } = req.body as {
      date?: string;
      amountCents?: number;
      categoryId?: string | null;
      description?: string;
      notes?: string;
    };
    if (!date || amountCents === undefined) {
      res.status(400).json({ error: "date and amountCents are required" });
      return;
    }
    try {
      assertPositiveCents(amountCents);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    if (categoryId) {
      const category = await prisma.overheadCategory.findFirst({ where: { id: categoryId, userId: req.user!.id } });
      if (!category) {
        res.status(400).json({ error: "Category does not belong to this account" });
        return;
      }
    }
    const expense = await prisma.overheadExpense.create({
      data: { userId: req.user!.id, date: new Date(date), amountCents, categoryId: categoryId ?? null, description, notes },
    });
    res.status(201).json(expense);
  }),
);

router.put(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.overheadExpense.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    const { date, amountCents, categoryId, description, notes } = req.body as {
      date?: string;
      amountCents?: number;
      categoryId?: string | null;
      description?: string;
      notes?: string;
    };
    const data: Prisma.OverheadExpenseUpdateInput = {};
    if (date !== undefined) data.date = new Date(date);
    if (description !== undefined) data.description = description;
    if (notes !== undefined) data.notes = notes;
    if (amountCents !== undefined) {
      try {
        assertPositiveCents(amountCents);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      data.amountCents = amountCents;
    }
    if (categoryId !== undefined) {
      if (categoryId) {
        const category = await prisma.overheadCategory.findFirst({ where: { id: categoryId, userId: req.user!.id } });
        if (!category) {
          res.status(400).json({ error: "Category does not belong to this account" });
          return;
        }
        data.category = { connect: { id: categoryId } };
      } else {
        data.category = { disconnect: true };
      }
    }
    const expense = await prisma.overheadExpense.update({ where: { id: existing.id }, data });
    res.json(expense);
  }),
);

router.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.overheadExpense.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    await prisma.overheadExpense.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
