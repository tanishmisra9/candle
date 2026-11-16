/** Citation chip under an assistant answer: a button that opens the trial dialog, or a new-tab link to PubMed. The full source title is in the accessible name and in a tooltip. */
import type { AskSource } from "../types";
import { Tooltip } from "./ui/Tooltip";

export function SourceChip({
  source,
  onOpenTrialSnapshot,
}: {
  source: AskSource;
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const label =
    source.label ??
    (source.source_type === "trial" ? `${source.source_id}` : source.title);
  const detail =
    source.detail ?? (source.source_type === "trial" ? "Trial" : `PMID ${source.source_id}`);
  const chipClass =
    "inline-flex min-h-11 max-w-full min-w-0 items-center overflow-hidden rounded-panel border border-line-strong bg-panel px-3 py-2 text-[13px] text-text transition-colors hover:border-accent";
  const content = (
    <>
      <span className="truncate">{label}</span>
      <span className="kicker ml-2 shrink-0 text-[11px] text-muted">{detail}</span>
      {/* The visible label is often just an id; keep the full title in the accessible name. */}
      <span className="sr-only">: {source.title}</span>
    </>
  );

  if (source.source_type === "trial" && onOpenTrialSnapshot) {
    return (
      <Tooltip label={source.title} describe={false} className="inline-flex min-w-0 max-w-[min(100%,20rem)]">
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
    <Tooltip label={source.title} describe={false} className="inline-flex min-w-0 max-w-[min(100%,20rem)]">
      <a href={source.url ?? "#"} target="_blank" rel="noreferrer" className={chipClass}>
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Tooltip>
  );
}
