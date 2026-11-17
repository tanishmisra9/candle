/** Citation chip under an assistant answer: a button that opens the trial dialog, or a new-tab link to PubMed. Title on the first line, id/status/phase on the second; the tooltip repeats the full title for a truncated one. */
import type { AskSource } from "../types";
import { displayTitle } from "../lib/formatters";
import { Tooltip } from "./ui/Tooltip";

export function SourceChip({
  source,
  onOpenTrialSnapshot,
}: {
  source: AskSource;
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  // Two lines: what the source IS (its title, truncated), then which one it is (id, status, phase). The title used to live only in a
  // hover tooltip, which a phone does not have, so a parent saw "NCT03496012 COMPLETED · PHASE3" and nothing about the trial.
  const isTrial = source.source_type === "trial";
  const idText = source.label && source.label !== source.title ? source.label : isTrial ? source.source_id : null;
  const detail = source.detail ?? (isTrial ? "Trial" : `PMID ${source.source_id}`);
  const kicker = [idText, detail].filter(Boolean).join(" · ");
  const chipClass =
    "flex min-h-11 w-full max-w-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-panel border border-line-strong bg-panel px-3 py-2 text-left text-[13px] text-text transition-colors hover:border-accent active:bg-text/5";
  const content = (
    <>
      <span className="truncate">{source.source_type === "publication" ? displayTitle(source.title) : source.title}</span>
      <span className="kicker truncate text-[11px] text-muted">{kicker}</span>
    </>
  );

  if (source.source_type === "trial" && onOpenTrialSnapshot) {
    return (
      <Tooltip label={source.title} describe={false} className="inline-flex min-w-0 max-w-full sm:max-w-[min(100%,22rem)]">
        <button
          type="button"
          onClick={() => onOpenTrialSnapshot(source.source_id)}
          className={chipClass}
        >
          {content}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={source.title} describe={false} className="inline-flex min-w-0 max-w-full sm:max-w-[min(100%,22rem)]">
      <a href={source.url ?? "#"} target="_blank" rel="noreferrer" className={chipClass}>
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Tooltip>
  );
}
