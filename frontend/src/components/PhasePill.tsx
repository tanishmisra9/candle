/** Trial phase label (hairline mono text; despite the name it is not pill-shaped). */
import { formatPhaseLabel } from "../lib/formatters";

export function PhasePill({ phase }: { phase: string | null }) {
  return (
    <span className="kicker inline-flex items-center rounded-panel border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted">
      {formatPhaseLabel(phase)}
    </span>
  );
}
