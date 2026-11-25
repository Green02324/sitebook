import { Router } from "express";
import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, withEffectiveUser } from "../lib/auth";
import { assertPositiveCents } from "../lib/money";
import { hoursToMinutes, summarizeEngagement, type EngagementSummary } from "../lib/consulting";
import { buildConsultingPdf, type ConsultingPdfSection } from "../lib/pdf";

const router = Router();
router.use(requireAuth, withEffectiveUser);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// null clears the rate; anything else must be a whole number of cents > 0.
function parseRate(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return { ok: false };
  return { ok: true, value };
}

type EngagementFull = Prisma.ConsultingEngagementGetPayload<{
  include: { bills: true; entries: true; expenses: true; payments: true; user: { select: { consultingRateCents: true; name: true } } };
}>;

const fullInclude = {
  bills: true,
  entries: true,
  expenses: true,
  payments: true,
  user: { select: { consultingRateCents: true, name: true } },
} as const;

// Reads see the viewed account's data (admin drill-in); writes only ever touch
// the signed-in user's own engagements.
async function findForRead(req: Request, id: string): Promise<EngagementFull | null> {
  return prisma.consultingEngagement.findFirst({ where: { id, userId: req.effectiveUserId }, include: fullInclude });
}

async function findForWrite(req: Request, id: string): Promise<EngagementFull | null> {
  return prisma.consultingEngagement.findFirst({ where: { id, userId: req.user!.id }, include: fullInclude });
}

function effectiveRate(e: EngagementFull): number | null {
  return e.rateCents ?? e.user.consultingRateCents ?? null;
}

function summarize(e: EngagementFull): EngagementSummary {
  return summarizeEngagement({
    bills: e.bills,
    entries: e.entries,
    expenses: e.expenses,
    payments: e.payments,
    currentRateCents: effectiveRate(e),
  });
}

function notFound(res: Response, what = "Engagement") {
  res.status(404).json({ error: `${what} not found` });
}

function openBills<B extends { number: number; closedAt: Date | null }>(e: { bills: B[] }): B[] {
  return e.bills.filter((b) => b.closedAt === null).sort((a, b) => b.number - a.number);
}

function headline(e: EngagementFull) {
  const s = summarize(e);
  const open = openBills(e)[0];
  const lastEntry = [...e.entries, ...e.expenses].reduce<Date | null>(
    (latest, x) => (latest === null || x.date > latest ? x.date : latest),
    null,
  );
  return {
    id: e.id,
    name: e.name,
    clientName: e.clientName,
    clientEmail: e.clientEmail,
    rateCents: e.rateCents,
    effectiveRateCents: effectiveRate(e),
    archivedAt: e.archivedAt,
    createdAt: e.createdAt,
    openBillNumber: open?.number ?? null,
    lastEntryDate: lastEntry ? lastEntry.toISOString().slice(0, 10) : null,
    totalMinutes: s.totalMinutes,
    billableCents: s.billableCents,
    expenseCents: s.expenseCents,
    paidCents: s.paidCents,
    balanceCents: s.balanceCents,
    creditCents: s.creditCents,
    unpaidMinutes: s.unpaidMinutes,
    unratedMinutes: s.unratedMinutes,
  };
}

function detail(e: EngagementFull) {
  const s = summarize(e);
  return {
    ...headline(e),
    notes: e.notes,
    defaultRateCents: e.user.consultingRateCents,
    summary: s,
    payments: [...e.payments]
      .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({ id: p.id, date: p.date.toISOString().slice(0, 10), amountCents: p.amountCents, note: p.note })),
  };
}

// A bill that's been sent shouldn't change its total when the rate later does,
// so closing pins every still-floating entry to the rate in force right now.
async function freezeRates(tx: Prisma.TransactionClient, billId: string, rateCents: number | null) {
  if (rateCents === null) return;
  await tx.consultingEntry.updateMany({ where: { billId, rateCents: null }, data: { rateCents } });
}

async function closeBill(tx: Prisma.TransactionClient, billId: string, rateCents: number | null) {
  await tx.consultingBill.update({ where: { id: billId }, data: { closedAt: new Date() } });
  await freezeRates(tx, billId, rateCents);
}

function hasCharges(e: EngagementFull, billId: string): boolean {
  return e.entries.some((x) => x.billId === billId) || e.expenses.some((x) => x.billId === billId);
}

// Where new hours or expenses land: the bill asked for, else the open one, else
// a freshly numbered bill.
async function targetBill(tx: Prisma.TransactionClient, e: EngagementFull, billId: unknown) {
  if (billId) {
    const asked = e.bills.find((b) => b.id === billId);
    if (!asked) throw new HttpError(400, "That bill doesn't belong to this engagement");
    return asked;
  }
  const open = openBills(e)[0];
  if (open) return open;
  const nextNumber = e.bills.reduce((m, b) => Math.max(m, b.number), 0) + 1;
  return tx.consultingBill.create({ data: { engagementId: e.id, number: nextNumber } });
}

// ---------------------------------------------------------------------------
// Engagements

router.get(
  "/engagements",
  ah(async (req, res) => {
    const engagements = await prisma.consultingEngagement.findMany({
      where: { userId: req.effectiveUserId },
      orderBy: { createdAt: "asc" },
      include: fullInclude,
    });
    res.json(engagements.map(headline));
  }),
);

router.post(
  "/engagements",
  ah(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const rate = parseRate(body.rateCents);
    if (!rate.ok) {
      res.status(400).json({ error: "Rate must be a positive amount" });
      return;
    }
    const created = await prisma.consultingEngagement.create({
      data: {
        userId: req.user!.id,
        name,
        clientName: cleanText(body.clientName),
        clientEmail: cleanText(body.clientEmail),
        notes: cleanText(body.notes),
        rateCents: rate.value,
      },
      include: fullInclude,
    });
    res.status(201).json(detail(created));
  }),
);

router.get(
  "/engagements/:id",
  ah(async (req, res) => {
    const e = await findForRead(req, req.params.id);
    if (!e) return notFound(res);
    res.json(detail(e));
  }),
);

router.put(
  "/engagements/:id",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const body = req.body as Record<string, unknown>;
    const data: Prisma.ConsultingEngagementUpdateInput = {};

    if (body.name !== undefined) {
      const name = cleanText(body.name);
      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      data.name = name;
    }
    if (body.clientName !== undefined) data.clientName = cleanText(body.clientName);
    if (body.clientEmail !== undefined) data.clientEmail = cleanText(body.clientEmail);
    if (body.notes !== undefined) data.notes = cleanText(body.notes);
    if (body.rateCents !== undefined) {
      const rate = parseRate(body.rateCents);
      if (!rate.ok) {
        res.status(400).json({ error: "Rate must be a positive amount" });
        return;
      }
      data.rateCents = rate.value;
    }
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;

    await prisma.consultingEngagement.update({ where: { id: e.id }, data });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.delete(
  "/engagements/:id",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    await prisma.consultingEngagement.delete({ where: { id: e.id } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Hours

router.post(
  "/engagements/:id/entries",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const body = req.body as Record<string, unknown>;

    const date = parseDate(body.date);
    if (!date) {
      res.status(400).json({ error: "A valid date is required" });
      return;
    }
    const minutes = hoursToMinutes(body.hours);
    if (minutes === null) {
      res.status(400).json({ error: "Hours must be more than 0 and no more than 24" });
      return;
    }
    const rate = effectiveRate(e);

    await prisma.$transaction(async (tx) => {
      const bill = await targetBill(tx, e, body.billId);
      await tx.consultingEntry.create({
        data: {
          engagementId: e.id,
          billId: bill.id,
          date,
          minutes,
          summary: cleanText(body.summary),
          // Entries landing in an already-sent bill are priced like the rest of it.
          rateCents: bill.closedAt ? rate : null,
        },
      });
    });

    const fresh = await findForWrite(req, e.id);
    res.status(201).json(detail(fresh!));
  }),
);

router.put(
  "/engagements/:id/entries/:entryId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const entry = e.entries.find((x) => x.id === req.params.entryId);
    if (!entry) return notFound(res, "Entry");
    const body = req.body as Record<string, unknown>;
    const data: Prisma.ConsultingEntryUncheckedUpdateInput = {};

    if (body.date !== undefined) {
      const date = parseDate(body.date);
      if (!date) {
        res.status(400).json({ error: "A valid date is required" });
        return;
      }
      data.date = date;
    }
    if (body.hours !== undefined) {
      const minutes = hoursToMinutes(body.hours);
      if (minutes === null) {
        res.status(400).json({ error: "Hours must be more than 0 and no more than 24" });
        return;
      }
      data.minutes = minutes;
    }
    if (body.summary !== undefined) data.summary = cleanText(body.summary);
    if (body.billId !== undefined && body.billId !== entry.billId) {
      const target = e.bills.find((b) => b.id === body.billId);
      if (!target) {
        res.status(400).json({ error: "That bill doesn't belong to this engagement" });
        return;
      }
      data.billId = target.id;
      // Moving into a sent bill pins the price; moving out of one lets it float again.
      data.rateCents = target.closedAt ? entry.rateCents ?? effectiveRate(e) : null;
    }

    await prisma.consultingEntry.update({ where: { id: entry.id }, data });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.delete(
  "/engagements/:id/entries/:entryId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const entry = e.entries.find((x) => x.id === req.params.entryId);
    if (!entry) return notFound(res, "Entry");
    await prisma.consultingEntry.delete({ where: { id: entry.id } });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

// ---------------------------------------------------------------------------
// Expenses (materials, fees and other costs to bill back)

const EXPENSE_CATEGORIES = ["Materials", "Fee", "Travel", "Other"];

router.post(
  "/engagements/:id/expenses",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const body = req.body as Record<string, unknown>;

    const date = parseDate(body.date);
    if (!date) {
      res.status(400).json({ error: "A valid date is required" });
      return;
    }
    try {
      assertPositiveCents(body.amountCents as number);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    if (!EXPENSE_CATEGORIES.includes(body.category as string)) {
      res.status(400).json({ error: "Choose an expense type" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const bill = await targetBill(tx, e, body.billId);
      await tx.consultingExpense.create({
        data: {
          engagementId: e.id,
          billId: bill.id,
          date,
          amountCents: body.amountCents as number,
          category: body.category as string,
          description: cleanText(body.description),
        },
      });
    });

    const fresh = await findForWrite(req, e.id);
    res.status(201).json(detail(fresh!));
  }),
);

router.put(
  "/engagements/:id/expenses/:expenseId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const expense = e.expenses.find((x) => x.id === req.params.expenseId);
    if (!expense) return notFound(res, "Expense");
    const body = req.body as Record<string, unknown>;
    const data: Prisma.ConsultingExpenseUncheckedUpdateInput = {};

    if (body.date !== undefined) {
      const date = parseDate(body.date);
      if (!date) {
        res.status(400).json({ error: "A valid date is required" });
        return;
      }
      data.date = date;
    }
    if (body.amountCents !== undefined) {
      try {
        assertPositiveCents(body.amountCents as number);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      data.amountCents = body.amountCents as number;
    }
    if (body.category !== undefined) {
      if (!EXPENSE_CATEGORIES.includes(body.category as string)) {
        res.status(400).json({ error: "Choose an expense type" });
        return;
      }
      data.category = body.category as string;
    }
    if (body.description !== undefined) data.description = cleanText(body.description);
    if (body.billId !== undefined && body.billId !== expense.billId) {
      const target = e.bills.find((b) => b.id === body.billId);
      if (!target) {
        res.status(400).json({ error: "That bill doesn't belong to this engagement" });
        return;
      }
      data.billId = target.id;
    }

    await prisma.consultingExpense.update({ where: { id: expense.id }, data });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.delete(
  "/engagements/:id/expenses/:expenseId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const expense = e.expenses.find((x) => x.id === req.params.expenseId);
    if (!expense) return notFound(res, "Expense");
    await prisma.consultingExpense.delete({ where: { id: expense.id } });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

// ---------------------------------------------------------------------------
// Bills

// Closes the current open bill by hand ("I've sent this one off").
router.post(
  "/engagements/:id/bills/close",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const target = openBills(e).find((b) => hasCharges(e, b.id));
    if (!target) {
      res.status(400).json({ error: "There is nothing open to bill" });
      return;
    }
    await prisma.$transaction((tx) => closeBill(tx, target.id, effectiveRate(e)));
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.put(
  "/engagements/:id/bills/:billId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const bill = e.bills.find((b) => b.id === req.params.billId);
    if (!bill) return notFound(res, "Bill");
    const { closed } = req.body as { closed?: boolean };
    if (typeof closed !== "boolean") {
      res.status(400).json({ error: "closed must be true or false" });
      return;
    }
    if (closed && !bill.closedAt) {
      await prisma.$transaction((tx) => closeBill(tx, bill.id, effectiveRate(e)));
    } else if (!closed && bill.closedAt) {
      await prisma.consultingBill.update({ where: { id: bill.id }, data: { closedAt: null } });
    }
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.delete(
  "/engagements/:id/bills/:billId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const bill = e.bills.find((b) => b.id === req.params.billId);
    if (!bill) return notFound(res, "Bill");
    if (hasCharges(e, bill.id)) {
      res.status(409).json({ error: "Move or delete this bill's hours and expenses first" });
      return;
    }
    await prisma.consultingBill.delete({ where: { id: bill.id } });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

// ---------------------------------------------------------------------------
// Payments

router.post(
  "/engagements/:id/payments",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const body = req.body as { date?: unknown; amountCents?: unknown; note?: unknown; closeBill?: unknown };

    const date = parseDate(body.date);
    if (!date) {
      res.status(400).json({ error: "A valid date is required" });
      return;
    }
    try {
      assertPositiveCents(body.amountCents as number);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.consultingPayment.create({
        data: { engagementId: e.id, date, amountCents: body.amountCents as number, note: cleanText(body.note) },
      });
      // A payment settles up the bill in progress, so the next hours begin the
      // next one. Skipped (or unticked) when there's nothing open to close.
      if (body.closeBill !== false) {
        const target = openBills(e).find((b) => hasCharges(e, b.id));
        if (target) await closeBill(tx, target.id, effectiveRate(e));
      }
    });

    const fresh = await findForWrite(req, e.id);
    res.status(201).json(detail(fresh!));
  }),
);

router.put(
  "/engagements/:id/payments/:paymentId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const payment = e.payments.find((p) => p.id === req.params.paymentId);
    if (!payment) return notFound(res, "Payment");
    const body = req.body as { date?: unknown; amountCents?: unknown; note?: unknown };
    const data: Prisma.ConsultingPaymentUpdateInput = {};

    if (body.date !== undefined) {
      const date = parseDate(body.date);
      if (!date) {
        res.status(400).json({ error: "A valid date is required" });
        return;
      }
      data.date = date;
    }
    if (body.amountCents !== undefined) {
      try {
        assertPositiveCents(body.amountCents as number);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      data.amountCents = body.amountCents as number;
    }
    if (body.note !== undefined) data.note = cleanText(body.note);

    await prisma.consultingPayment.update({ where: { id: payment.id }, data });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

router.delete(
  "/engagements/:id/payments/:paymentId",
  ah(async (req, res) => {
    const e = await findForWrite(req, req.params.id);
    if (!e) return notFound(res);
    const payment = e.payments.find((p) => p.id === req.params.paymentId);
    if (!payment) return notFound(res, "Payment");
    await prisma.consultingPayment.delete({ where: { id: payment.id } });
    const fresh = await findForWrite(req, e.id);
    res.json(detail(fresh!));
  }),
);

// ---------------------------------------------------------------------------
// PDF — one bill, or (without billId) the complete log

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "engagement";
}

router.get(
  "/engagements/:id/pdf",
  ah(async (req, res) => {
    const e = await findForRead(req, req.params.id);
    if (!e) return notFound(res);
    const { billId } = req.query as { billId?: string };
    const s = summarize(e);

    const bills = billId ? s.bills.filter((b) => b.id === billId) : s.bills;
    if (billId && bills.length === 0) return notFound(res, "Bill");

    const sections: ConsultingPdfSection[] = bills
      .filter((b) => b.entries.length > 0 || b.expenses.length > 0 || billId)
      .map((b) => ({
        title: `Bill ${b.number}`,
        minutes: b.minutes,
        amountCents: b.amountCents,
        expenses: b.expenses.map((x) => ({
          date: x.date,
          category: x.category,
          description: x.description,
          amountCents: x.amountCents,
        })),
        entries: b.entries.map((x) => ({
          date: x.date,
          minutes: x.minutes,
          rateCents: x.rateCents,
          amountCents: x.amountCents,
          summary: x.summary,
        })),
      }));

    const totalMinutes = bills.reduce((n, b) => n + b.minutes, 0);
    const totalCents = bills.reduce((n, b) => n + b.amountCents, 0);
    // For one bill, only what's been applied to *its* hours; for the whole log,
    // every payment received (including any overpayment credit).
    const paidCents = billId ? bills.reduce((n, b) => n + b.paidCents, 0) : s.paidCents;

    const pdfBytes = await buildConsultingPdf({
      consultantName: e.user.name,
      engagementName: e.name,
      clientName: e.clientName,
      scopeLabel: billId ? `Bill ${bills[0].number}` : "Complete time log",
      generatedAt: new Date().toISOString().slice(0, 10),
      sections,
      totalMinutes,
      totalCents,
      expenseCents: bills.reduce((n, b) => n + b.expenseCents, 0),
      paidCents,
      balanceCents: Math.max(0, totalCents - paidCents),
      payments: billId
        ? undefined
        : [...e.payments]
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((p) => ({ date: p.date.toISOString().slice(0, 10), amountCents: p.amountCents, note: p.note })),
      hasUnrated: bills.some((b) => b.entries.some((x) => x.rateCents === null)),
    });

    const suffix = billId ? `bill-${bills[0].number}` : "time-log";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug(e.name)}-${suffix}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }),
);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Surface validation errors thrown from inside a transaction as 400s rather
// than the generic 500.
router.use((err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  next(err);
});

export default router;
