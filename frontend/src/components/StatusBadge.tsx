/** Trial status label: text plus a marker shape per tier (active, completed, terminated, unknown) so status is never colour alone. */
import { formatStatusLabel, normalizeStatus } from "../lib/formatters";
import clsx from "clsx";

export function statusTier(status: string | null): "active" | "completed" | "terminated" | "unknown" {
  const normalized = normalizeStatus(status);

  if (
    [
      "RECRUITING",
      "ENROLLING_BY_INVITATION",
      "NOT_YET_RECRUITING",
      "ACTIVE_NOT_RECRUITING",
    ].includes(normalized)
  ) {
    return "active";
  }

  if (normalized === "COMPLETED") {
    return "completed";
  }

  if (["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(normalized)) {
    return "terminated";
  }

  return "unknown";
}

// Marker shape differs per tier so status never depends on colour alone (WCAG 1.4.1); the text
// label is the primary signal and the marker is decorative.
const tierMarker = {
  active: "bg-success",
  completed: "border border-muted",
  terminated: "rotate-45 bg-danger",
  unknown: "border border-dashed border-muted",
} as const;

export type StatusTier = ReturnType<typeof statusTier>;

/** What each tier means, in words: the Guide's group titles and the Timeline legend both come from here, so they cannot disagree. */
export const STATUS_TIER_TITLES: Record<StatusTier, string> = {
  active: "Planned or under way",
  completed: "Finished",
  terminated: "Ended early or paused",
  unknown: "Status not stated",
};

/** The marker square/diamond shown before a status. Shared so the Guide legend uses the exact shapes of the trial cards. */
export function StatusMarker({ tier, className }: { tier: StatusTier; className?: string }) {
  return <span aria-hidden="true" className={clsx("h-2 w-2 shrink-0", tierMarker[tier], className)} />;
}

export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  return (
    <span className={clsx(
        "kicker inline-flex items-center whitespace-nowrap gap-2 rounded-panel border border-line px-2.5 py-1.5 text-[11px] font-medium text-text",
        className,
      )}>
      <StatusMarker tier={statusTier(status)} />
      {formatStatusLabel(status)}
    </span>
  );
}
