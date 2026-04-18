import { formatStatusLabel } from "../lib/formatters";
import { cn } from "../lib/cn";

export function formatStatus(status: string | null) {
  return formatStatusLabel(status);
}

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

const tierStyles = {
  active: "bg-[rgba(52,199,89,0.1)] border-[rgba(52,199,89,0.22)] text-[#34C759]",
  completed: "border-line bg-glass text-muted",
  terminated:
    "bg-[rgba(255,69,58,0.08)] border-[rgba(255,69,58,0.16)] text-[rgba(255,69,58,0.7)]",
  unknown: "border-line bg-glass text-muted",
} as const;

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-2xl",
        tierStyles[statusTier(status)],
      )}
    >
      {formatStatus(status)}
    </span>
  );
}
