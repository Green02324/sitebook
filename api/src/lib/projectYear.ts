import type { Project } from "@prisma/client";

// A project is attributed to a single calendar year for dashboard/report
// rollups — the year it's completed (or targeted to complete), falling back
// to its start date or creation date if not set. Jobs spanning two calendar
// years aren't split between them; the whole project's activity counts
// toward the one year it's associated with.
export function projectAttributedYear(project: Pick<Project, "targetCompletionDate" | "startDate" | "createdAt">): number {
  const date = project.targetCompletionDate ?? project.startDate ?? project.createdAt;
  return date.getUTCFullYear();
}
