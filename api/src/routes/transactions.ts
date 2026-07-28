import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { assertPositiveCents } from "../lib/money";
import type { Prisma, TransactionMode, TransactionType } from "@prisma/client";

const router = Router({ mergeParams: true });

router.get(
  "/",
  ah(async (req, res) => {
    const { mode, type, categoryId, sort } = req.query as {
      mode?: TransactionMode;
      type?: TransactionType;
      categoryId?: string;
      sort?: "date" | "amount";
    };
    const where: Prisma.TransactionWhereInput = { projectId: req.project!.id };
    if (mode) where.mode = mode;
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;

    // Estimates carry a hand-set construction order; actuals stay in date
    // order so they still read like a ledger against receipts. Rows that have
    // never been moved sort last and fall back to creation order.
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
      mode === "ESTIMATE" && sort !== "amount"
        ? [{ sortOrder: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
        : [sort === "amount" ? { amountCents: "desc" } : { date: "desc" }];

    const transactions = await prisma.transaction.findMany({ where, orderBy, include: { category: true } });
    res.json(transactions);
  }),
);

// Takes the full ordered list of ids and writes positions, rather than
// swapping neighbours — idempotent, and it doesn't have to reason about rows
// whose sortOrder is still null.
router.put(
  "/reorder",
  ah(async (req, res) => {
    const { ids } = req.body as { ids?: unknown };
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      res.status(400).json({ error: "ids must be an array of transaction ids" });
      return;
    }

    // Only reposition rows that actually belong to this project, so a stale or
    // tampered list can't touch another job's line items.
    const owned = await prisma.transaction.findMany({
      where: { id: { in: ids as string[] }, projectId: req.project!.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));

    await prisma.$transaction(
      (ids as string[])
        .filter((id) => ownedIds.has(id))
        .map((id, index) => prisma.transaction.update({ where: { id }, data: { sortOrder: index } })),
    );

    res.status(204).end();
  }),
);

router.post(
  "/",
  ah(async (req, res) => {
    const { type, mode, date, amountCents, categoryId, description, notes } = req.body as {
      type?: TransactionType;
      mode?: TransactionMode;
      date?: string;
      amountCents?: number;
      categoryId?: string | null;
      description?: string;
      notes?: string;
    };
    if (!type || !mode || !date || amountCents === undefined) {
      res.status(400).json({ error: "type, mode, date, and amountCents are required" });
      return;
    }
    try {
      assertPositiveCents(amountCents);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, projectId: req.project!.id } });
      if (!category) {
        res.status(400).json({ error: "Category does not belong to this project" });
        return;
      }
    }
    const transaction = await prisma.transaction.create({
      data: {
        projectId: req.project!.id,
        type,
        mode,
        date: new Date(date),
        amountCents,
        categoryId: categoryId ?? null,
        description,
        notes,
      },
    });
    res.status(201).json(transaction);
  }),
);

router.put(
  "/:txId",
  ah(async (req, res) => {
    const existing = await prisma.transaction.findFirst({ where: { id: req.params.txId, projectId: req.project!.id } });
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const { type, mode, date, amountCents, categoryId, description, notes } = req.body as {
      type?: TransactionType;
      mode?: TransactionMode;
      date?: string;
      amountCents?: number;
      categoryId?: string | null;
      description?: string;
      notes?: string;
    };

    const data: Prisma.TransactionUpdateInput = {};
    if (type !== undefined) data.type = type;
    if (mode !== undefined) data.mode = mode;
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
        const category = await prisma.category.findFirst({ where: { id: categoryId, projectId: req.project!.id } });
        if (!category) {
          res.status(400).json({ error: "Category does not belong to this project" });
          return;
        }
        data.category = { connect: { id: categoryId } };
      } else {
        data.category = { disconnect: true };
      }
    }

    const transaction = await prisma.transaction.update({ where: { id: existing.id }, data });
    res.json(transaction);
  }),
);

router.delete(
  "/:txId",
  ah(async (req, res) => {
    const existing = await prisma.transaction.findFirst({ where: { id: req.params.txId, projectId: req.project!.id } });
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    await prisma.transaction.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
