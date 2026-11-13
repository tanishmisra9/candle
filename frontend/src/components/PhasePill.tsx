/** Trial phase label (hairline mono text; despite the name it is not pill-shaped). */
import clsx from "clsx";

import { formatPhaseLabel } from "../lib/formatters";

export function PhasePill({ phase, className }: { phase: string | null; className?: string }) {
  return (
    <span className={clsx(
        "kicker inline-flex items-center rounded-panel border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted",
        className,
      )}>
      {formatPhaseLabel(phase)}
    </span>
  );
}
