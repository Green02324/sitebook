export function toCents(input: string | number): number {
  const value = typeof input === "string" ? Number(input) : input;
  if (!Number.isFinite(value)) {
    throw new Error("Amount must be a finite number");
  }
  const cents = Math.round(value * 100);
  assertPositiveCents(cents);
  return cents;
}

export function assertPositiveCents(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Amount must be a positive number");
  }
}

// An estimate line may sit at zero: the scope gets laid out during planning
// and priced once the order of operations is settled. An actual entry always
// represents money that actually moved, so zero there is a data-entry slip.
export function assertAmountCents(cents: number, mode: "ESTIMATE" | "ACTUAL") {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error("Amount must be a positive number");
  }
  if (mode === "ACTUAL" && cents === 0) {
    throw new Error("Amount must be a positive number");
  }
}

// Profit as a percentage of revenue (margin), not of cost (markup):
// (Credits - Debits) / Credits. Null when there's no revenue to divide by.
export function profitPercent(creditsCents: number, debitsCents: number): number | null {
  if (creditsCents <= 0) return null;
  return ((creditsCents - debitsCents) / creditsCents) * 100;
}
