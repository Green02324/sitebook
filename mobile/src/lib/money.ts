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
