import type { Project, ProjectStatus } from "../types";

export type SortKey = "name" | "clientLastName" | "address" | "status";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Title" },
  { key: "clientLastName", label: "Client last name" },
  { key: "address", label: "Address" },
  { key: "status", label: "Status" },
];

// Job lifecycle order, matching the ProjectStatus enum — sorting the status
// strings alphabetically would put Completed before Planning, which reads
// backwards on a list of jobs.
const STATUS_ORDER: Record<ProjectStatus, number> = { PLANNING: 0, ACTIVE: 1, COMPLETED: 2 };

// "Sarah Thompson" -> "Thompson". Single-word names are their own last name,
// so a company like "Acme" still sorts somewhere sensible.
export function lastName(clientName: string | null): string {
  const parts = (clientName ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

// numeric so "2 Oak St" sorts before "12 Oak St"; base sensitivity so casing
// and accents don't split otherwise-identical names apart.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// Projects missing the field being sorted on sink to the bottom instead of
// clumping at the top as a run of blanks.
function compareText(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b);
}

// Every sort falls back to title so the order is total — two jobs for the same
// client, or two with no address, keep a stable, predictable position.
export function sortProjects(projects: Project[], key: SortKey): Project[] {
  return [...projects].sort((a, b) => {
    switch (key) {
      case "clientLastName":
        return compareText(lastName(a.clientName), lastName(b.clientName)) || compareText(a.name, b.name);
      case "address":
        return compareText(a.address ?? "", b.address ?? "") || compareText(a.name, b.name);
      case "status":
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || compareText(a.name, b.name);
      default:
        return compareText(a.name, b.name);
    }
  });
}
