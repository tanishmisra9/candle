/** Publication list row (one `<button>`, same no-nested-interactive rule as `TrialCard`). */
import { memo } from "react";

import { highlightText } from "../lib/highlight";
import type { PublicationSummary } from "../types";

type PublicationRowProps = {
  publication: PublicationSummary;
  query?: string;
  onOpen: (publication: PublicationSummary) => void;
};

function formatMeta(publication: PublicationSummary) {
  const lead = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const authors = publication.authors.length > 1 ? `${lead} et al.` : lead;
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return [publication.journal || "Journal not listed", year, authors].join(" · ");
}

const PREVIEW_LENGTH = 200;
const CONCLUSION_SECTION =
  /\b(?:Conclusions?|CONCLUSIONS?)\s*:\s*([\s\S]*?)(?=\s+(?:[A-Z][A-Z ]{2,}|Trial registration|Clinical trial registration|Registration|Funding|Disclosures?|Keywords?)\s*:|$)/;

/** The "Conclusion(s):" part of a structured abstract when there is one (what a skimmer wants), else the opening. */
function abstractPreview(abstract: string | null) {
  if (!abstract?.trim()) {
    return null;
  }
  const trimmed = abstract.trim();
  // The labelled section only ("Conclusion:" / "CONCLUSIONS:", not "we conclude:"), up to the next section label (an
  // ALL-CAPS one, or the boilerplate ones PubMed appends) so registration and funding lines don't trail the preview.
  const conclusion = CONCLUSION_SECTION.exec(trimmed)?.[1]?.trim();
  const text = conclusion || trimmed;
  if (text.length <= PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

export const PublicationRow = memo(function PublicationRow({
  publication,
  query = "",
  onOpen,
}: PublicationRowProps) {
  const preview = abstractPreview(publication.abstract);

  return (
    <button
      type="button"
      onClick={() => onOpen(publication)}
      className="flex w-full flex-col gap-4 border-b border-line px-2 py-6 text-left transition-colors hover:bg-text/[0.06] md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-medium leading-7 tracking-[-0.015em] text-text">
              {highlightText(publication.title, query)}
            </h2>
            <p className="mt-2 text-[15px] text-muted">{formatMeta(publication)}</p>
            {preview ? (
              <p className="mt-3 line-clamp-3 text-[14px] leading-[1.6] text-muted">
                {highlightText(preview, query)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {publication.trial_id ? (
        <div className="flex items-center gap-3">
          <span className="kicker inline-flex items-center rounded-panel border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted">
            Trial {publication.trial_id}
          </span>
        </div>
      ) : null}
    </button>
  );
});
