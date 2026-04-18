import { formatPhaseLabel } from "../lib/formatters";

export function PhasePill({ phase }: { phase: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted">
      {formatPhaseLabel(phase)}
    </span>
  );
}
