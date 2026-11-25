// Billing math for consulting engagements, kept in one place so the screen, the
// list view and the PDF can never disagree about what's owed.
//
// Hours are stored as whole minutes and money as whole cents. An entry's value
// is minutes * rate / 60 rounded to the nearest cent, so nothing accumulates
// floating-point drift across a long log.

export interface EntryInput {
  id: string;
  billId: string;
  date: Date;
  createdAt: Date;
  minutes: number;
  summary: string | null;
  rateCents: number | null;
}

export interface ExpenseInput {
  id: string;
  billId: string;
  date: Date;
  createdAt: Date;
  amountCents: number;
  category: string;
  description: string | null;
}

export interface BillInput {
  id: string;
  number: number;
  closedAt: Date | null;
}

export interface PaymentInput {
  amountCents: number;
  // A reimbursement aimed at one expense; null/absent for ordinary payments.
  expenseId?: string | null;
}

export type PaidStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface EntrySummary {
  id: string;
  billId: string;
  date: string;
  minutes: number;
  summary: string | null;
  // The rate this entry is actually valued at (its own, or the current
  // engagement/account rate); null when there isn't one anywhere.
  rateCents: number | null;
  amountCents: number;
  paidCents: number;
  status: PaidStatus;
}

export interface ExpenseSummary {
  id: string;
  billId: string;
  date: string;
  category: string;
  description: string | null;
  amountCents: number;
  paidCents: number;
  // The share of paidCents that came from payments naming this expense.
  reimbursedCents: number;
  status: PaidStatus;
}

export interface BillSummary {
  id: string;
  number: number;
  closed: boolean;
  closedAt: string | null;
  minutes: number;
  // Hours and expenses together; expenseCents is the expense share of it.
  amountCents: number;
  expenseCents: number;
  paidCents: number;
  status: PaidStatus;
  entries: EntrySummary[];
  expenses: ExpenseSummary[];
}

export interface EngagementSummary {
  totalMinutes: number;
  billableCents: number;
  // The part of billableCents that is expenses rather than time.
  expenseCents: number;
  paidCents: number;
  // Billable minus paid. Never negative; an overpayment shows as creditCents.
  balanceCents: number;
  creditCents: number;
  // Hours not yet covered by payments, counting a partly-paid entry for the
  // fraction still owed. Hours with no rate can't be paid off, so they stay.
  unpaidMinutes: number;
  // Hours that exist but have no rate to value them at.
  unratedMinutes: number;
  bills: BillSummary[];
}

export function entryAmountCents(minutes: number, rateCents: number | null): number {
  if (rateCents === null) return 0;
  return Math.round((minutes * rateCents) / 60);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function statusFor(amountCents: number, paidCents: number): PaidStatus {
  if (amountCents > 0 && paidCents >= amountCents) return "PAID";
  if (paidCents > 0) return "PARTIAL";
  return "UNPAID";
}

// Payments are applied to the oldest charges first — bill by bill in number
// order, and by date within a bill, hours and expenses alike — so one check that
// overshoots a bill carries straight on into the next one.
export function summarizeEngagement(opts: {
  bills: BillInput[];
  entries: EntryInput[];
  expenses: ExpenseInput[];
  payments: PaymentInput[];
  // Rate used for any entry that hasn't had one frozen onto it yet.
  currentRateCents: number | null;
}): EngagementSummary {
  const { bills, entries, expenses, payments, currentRateCents } = opts;
  // Money aimed at a particular expense goes there first. Whatever it doesn't
  // need (and every ordinary payment) goes into the oldest-first pool.
  const expenseAmounts = new Map(expenses.map((x) => [x.id, x.amountCents]));
  const earmarked = new Map<string, number>();
  let remaining = 0;
  let totalPaid = 0;
  for (const p of payments) {
    totalPaid += p.amountCents;
    let spare = p.amountCents;
    if (p.expenseId && expenseAmounts.has(p.expenseId)) {
      const already = earmarked.get(p.expenseId) ?? 0;
      const used = Math.min(spare, expenseAmounts.get(p.expenseId)! - already);
      earmarked.set(p.expenseId, already + used);
      spare -= used;
    }
    remaining += spare;
  }

  let totalMinutes = 0;
  let billable = 0;
  let expenseTotal = 0;
  let unpaidMinutes = 0;
  let unratedMinutes = 0;

  const orderedBills = [...bills].sort((a, b) => a.number - b.number);
  const billSummaries: BillSummary[] = orderedBills.map((bill) => {
    const charges = [
      ...entries.filter((e) => e.billId === bill.id).map((e) => ({ entry: e, expense: null, date: e.date, createdAt: e.createdAt })),
      ...expenses.filter((x) => x.billId === bill.id).map((x) => ({ entry: null, expense: x, date: x.date, createdAt: x.createdAt })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime());

    let billMinutes = 0;
    let billAmount = 0;
    let billExpenses = 0;
    let billPaid = 0;
    const entrySummaries: EntrySummary[] = [];
    const expenseSummaries: ExpenseSummary[] = [];

    for (const charge of charges) {
      if (charge.expense) {
        const x = charge.expense;
        const reimbursed = earmarked.get(x.id) ?? 0;
        const fromPool = Math.min(remaining, x.amountCents - reimbursed);
        remaining -= fromPool;
        const applied = reimbursed + fromPool;
        billAmount += x.amountCents;
        billExpenses += x.amountCents;
        billPaid += applied;
        billable += x.amountCents;
        expenseTotal += x.amountCents;
        expenseSummaries.push({
          id: x.id,
          billId: x.billId,
          date: isoDate(x.date),
          category: x.category,
          description: x.description,
          amountCents: x.amountCents,
          paidCents: applied,
          reimbursedCents: reimbursed,
          status: statusFor(x.amountCents, applied),
        });
        continue;
      }

      const e = charge.entry!;
      const rate = e.rateCents ?? currentRateCents;
      const amount = entryAmountCents(e.minutes, rate);
      const applied = Math.min(remaining, amount);
      remaining -= applied;

      billMinutes += e.minutes;
      billAmount += amount;
      billPaid += applied;
      totalMinutes += e.minutes;
      billable += amount;

      if (rate === null || amount === 0) {
        // Nothing to pay these hours off with until a rate exists.
        unratedMinutes += e.minutes;
        unpaidMinutes += e.minutes;
      } else {
        unpaidMinutes += Math.round(e.minutes * (1 - applied / amount));
      }

      entrySummaries.push({
        id: e.id,
        billId: e.billId,
        date: isoDate(e.date),
        minutes: e.minutes,
        summary: e.summary,
        rateCents: rate,
        amountCents: amount,
        paidCents: applied,
        status: statusFor(amount, applied),
      });
    }

    return {
      id: bill.id,
      number: bill.number,
      closed: bill.closedAt !== null,
      closedAt: bill.closedAt ? bill.closedAt.toISOString() : null,
      minutes: billMinutes,
      amountCents: billAmount,
      expenseCents: billExpenses,
      paidCents: billPaid,
      status: statusFor(billAmount, billPaid),
      entries: entrySummaries,
      expenses: expenseSummaries,
    };
  });

  return {
    totalMinutes,
    billableCents: billable,
    expenseCents: expenseTotal,
    paidCents: totalPaid,
    balanceCents: Math.max(0, billable - totalPaid),
    creditCents: Math.max(0, totalPaid - billable),
    unpaidMinutes,
    unratedMinutes,
    bills: billSummaries,
  };
}

// "1.5" hours -> 90 minutes. Rejects anything that isn't a positive amount of
// time that fits in a day; returns null so the caller can phrase the error.
export function hoursToMinutes(hours: unknown): number | null {
  const value = typeof hours === "number" ? hours : Number(hours);
  if (!Number.isFinite(value) || value <= 0 || value > 24) return null;
  return Math.round(value * 60);
}
