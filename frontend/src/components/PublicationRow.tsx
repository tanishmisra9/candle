/** Publication list row (one `<button>`, same no-nested-interactive rule as `TrialCard`). */
import { memo } from "react";

import { highlightText } from "../lib/highlight";
import type { PublicationSummary } from "../types";

type PublicationRowProps = {
  publication: PublicationSummary;
  query?: string;
  onOpen: (publication: PublicationSummary) => void;
};

function formatAuthors(publication: PublicationSummary) {
  const leadAuthor = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return `${leadAuthor} et al., ${year}`;
}

function abstractPreview(abstract: string | null) {
  if (!abstract?.trim()) {
    return null;
  }
  const trimmed = abstract.trim();
  if (trimmed.length <= 200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 200).trimEnd()}…`;
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
            <p className="mt-2 text-[15px] text-muted">{formatAuthors(publication)}</p>
            <p className="mt-1.5 text-[15px] italic text-muted">
              {publication.journal || "Journal not listed"}
            </p>
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
          <span className="kicker inline-flex items-center rounded-panel border border-accent bg-accent/[0.12] px-2.5 py-1.5 text-[11px] font-medium text-accent">
            {publication.trial_id}
          </span>
        </div>
      ) : null}
    </button>
  );
});
