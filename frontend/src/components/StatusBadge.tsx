/** Trial status label: text plus a marker shape per tier (active, completed, terminated, unknown) so status is never colour alone. */
import { formatStatusLabel } from "../lib/formatters";
import clsx from "clsx";

function statusTier(status: string | null): "active" | "completed" | "terminated" | "unknown" {
  const normalized = (status ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="kicker inline-flex items-center gap-2 rounded-panel border border-line px-2.5 py-1.5 text-[11px] font-medium text-text">
      <span
        aria-hidden="true"
        className={clsx("h-2 w-2 shrink-0", tierMarker[statusTier(status)])}
      />
      {formatStatusLabel(status)}
    </span>
  );
}
