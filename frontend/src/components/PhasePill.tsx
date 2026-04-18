import { formatPhaseLabel } from "../lib/formatters";

export function PhasePill({ phase }: { phase: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted">
      {formatPhaseLabel(phase)}
    </span>
  );
}
