import { cn } from "../lib/cn";
import { formatStatusLabel } from "../lib/formatters";

const STATUS_STYLES: Array<[string, string]> = [
  ["recruit", "bg-emerald-400/80"],
  ["active", "bg-sky-400/80"],
  ["complete", "bg-zinc-400/80"],
  ["terminat", "bg-rose-400/80"],
  ["withdraw", "bg-rose-400/80"],
];

function toneForStatus(status: string | null) {
  const normalized = (status ?? "Unknown").toLowerCase();
  return STATUS_STYLES.find(([key]) => normalized.includes(key))?.[1] ?? "bg-zinc-400/80";
}

export function formatStatus(status: string | null) {
  return formatStatusLabel(status);
}

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-[rgba(255,255,255,0.72)] px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-2xl dark:bg-[rgba(20,20,25,0.65)]">
      <span className={cn("h-1.5 w-1.5 rounded-full", toneForStatus(status))} />
      {formatStatus(status)}
    </span>
  );
}
