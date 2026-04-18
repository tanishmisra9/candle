import type { AskSource } from "../types";

export function SourceChip({ source }: { source: AskSource }) {
  const label =
    source.label ??
    (source.source_type === "trial" ? `${source.source_id}` : source.title);
  const detail =
    source.detail ?? (source.source_type === "trial" ? "Trial" : "PubMed");

  return (
    <a
      href={source.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      className="inline-flex max-w-[min(100%,20rem)] min-w-0 items-center overflow-hidden rounded-full border border-line bg-glass px-3 py-1.5 text-[12px] text-muted backdrop-blur-2xl transition hover:border-[rgba(232,163,61,0.28)] hover:text-text"
    >
      <span className="truncate">{label}</span>
      <span className="ml-1.5 shrink-0 text-[11px] text-muted/80">· {detail}</span>
    </a>
  );
}
