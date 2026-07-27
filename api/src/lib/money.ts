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
