import { formatStatusLabel } from "../lib/formatters";

export function formatStatus(status: string | null) {
  return formatStatusLabel(status);
}

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-[rgba(255,255,255,0.72)] px-3 py-1.5 text-[12px] font-medium text-muted backdrop-blur-2xl dark:bg-[rgba(20,20,25,0.65)]">
      {formatStatus(status)}
    </span>
  );
}
