// Display helpers for the Hours Tracking pages.

// Hours are stored as whole minutes; people think in decimal hours (2.5), so
// show them that way, trimming needless zeros.
export function hoursValue(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatHours(minutes: number): string {
  return `${hoursValue(minutes)} hrs`;
}

// Today in the user's own calendar — toISOString() would flip to tomorrow in
// the evening for anyone west of UTC.
export function todayLocal(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// "2026-02-10" shown as a calendar day, without letting the timezone shift it.
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "engagement";
}
