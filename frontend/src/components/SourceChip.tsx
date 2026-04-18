import type { AskSource } from "../types";

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
    source.detail ?? (source.source_type === "trial" ? "Trial" : "PubMed");
  const chipClass =
    "inline-flex max-w-[min(100%,20rem)] min-w-0 items-center overflow-hidden rounded-full border border-line bg-glass px-3 py-1.5 text-[12px] text-muted backdrop-blur-2xl transition hover:border-[rgba(232,163,61,0.28)] hover:text-text";
  const content = (
    <>
      <span className="truncate">{label}</span>
      <span className="ml-1.5 shrink-0 text-[11px] text-muted/80">· {detail}</span>
    </>
  );

  if (source.source_type === "trial" && onOpenTrialSnapshot) {
    return (
      <button
        type="button"
        onClick={() => onOpenTrialSnapshot(source.source_id)}
        title={source.title}
        className={chipClass}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={source.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      className={chipClass}
    >
      {content}
    </a>
  );
}
