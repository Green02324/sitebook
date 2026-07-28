import type { ProjectStatus } from "../types";

const STYLES: Record<ProjectStatus, string> = {
  PLANNING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-slate-200 text-slate-700",
};

const LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

// Job lifecycle order, matching the ProjectStatus enum.
export const PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "ACTIVE", "COMPLETED"];

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>{LABELS[status]}</span>;
}

// The same pill, but a real <select> so the stage can be changed in place.
// Native rather than a custom popover: phones get their own picker for free
// and there's no outside-click dismissal to get wrong. The click handlers stop
// the surrounding card Link from navigating when the picker is used.
export function ProjectStatusSelect({
  status,
  onChange,
  disabled,
}: {
  status: ProjectStatus;
  onChange: (next: ProjectStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Project stage"
      value={status}
      disabled={disabled}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value as ProjectStatus);
      }}
      className={`cursor-pointer appearance-none rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:opacity-60 ${STYLES[status]}`}
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {LABELS[s]}
        </option>
      ))}
    </select>
  );
}
