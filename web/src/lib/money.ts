export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCents(input: string): number {
  const value = Number(input);
  if (!Number.isFinite(value)) throw new Error("Amount must be a number");
  return Math.round(value * 100);
}

export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Profit as a percentage of revenue (margin): (Credits - Debits) / Credits.
// Null when there's no revenue to divide by.
export function profitPercent(creditsCents: number, debitsCents: number): number | null {
  if (creditsCents <= 0) return null;
  return ((creditsCents - debitsCents) / creditsCents) * 100;
}

export function formatPercent(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(1)}%`;
}
