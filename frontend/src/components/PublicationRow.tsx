/** Publication list row (one `<button>`, same no-nested-interactive rule as `TrialCard`). */
import { memo } from "react";

import { displayTitle, formatLeadAuthor } from "../lib/formatters";
import { highlightText } from "../lib/highlight";
import type { PublicationSummary } from "../types";

type PublicationRowProps = {
  publication: PublicationSummary;
  query?: string;
  onOpen: (publication: PublicationSummary) => void;
};

function formatMeta(publication: PublicationSummary) {
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return [publication.journal || "Journal not listed", year, formatLeadAuthor(publication.authors)].join(" · ");
}

const PREVIEW_LENGTH = 200;
const WINDOW_AROUND_HIT = 100;
// The labelled section only ("Conclusion:" / "CONCLUSIONS:" / "INTERPRETATION:" as Lancet abstracts call it, not "we conclude:"), up to
// the next section label (an ALL-CAPS one, or the boilerplate ones PubMed appends) so registration and funding lines don't trail it.
const CONCLUSION_SECTION =
  /\b(?:Conclusions?|CONCLUSIONS?|Interpretation|INTERPRETATION)\s*:\s*([\s\S]*?)(?=\s+(?:[A-Z][A-Z ]{2,}|Trial registration|Clinical trial registration|Registration|Funding|Disclosures?|Keywords?)\s*:|$)/;
const LEADING_LABEL = /^[A-Z][A-Z &/,-]{2,40}:\s*/;
// Some abstracts run a funding sentence on with no label ("...treatment.Funding for the study provided by NIH..."): drop it. Only the
// forms that really occur ("Funding for/was/is/provided/support"): "Supported by these data, ..." is a normal sentence and was cut.
const UNLABELLED_FUNDING = /\s+Funding (?:for|was|is|provided|support)\b[\s\S]*$/;
// Two glued sentences: a word of 3+ lowercase letters (or a closing bracket), a full stop, a capitalised word. NOT a single letter before
// the stop, or the protein notation in genetics abstracts is mangled ("(p.Val529Hisfs*6)" became "p. Val529Hisfs*6"; 7 real abstracts).
const GLUED_SENTENCES = /([a-z]{3,}|\))\.([A-Z][a-z]{2,})/g;
const TRAILING_PUNCTUATION = /[\s.,;:]+$/;

/** One line of plain text: breaks collapsed, and a space put back where two sentences were glued ("treatment.Funding"). */
function tidy(text: string) {
  return text.replace(/\s+/g, " ").replace(GLUED_SENTENCES, "$1. $2").trim();
}

/**
 * What the row shows under the title. The abstract's conclusion (or interpretation) when it has one, else its opening without the
 * section label; cut at a word, not mid-word, and never "….". When a search is active and the term is NOT in that text, a window
 * around its first hit in the abstract instead, so a match found in the abstract is visible (it used to look like a wrong result).
 */
function abstractPreview(abstract: string | null, query = "") {
  if (!abstract?.trim()) {
    return null;
  }
  const trimmed = abstract.trim();
  const conclusion = CONCLUSION_SECTION.exec(trimmed)?.[1];
  const base = conclusion?.trim()
    ? tidy(conclusion).replace(UNLABELLED_FUNDING, "")
    : tidy(trimmed).replace(LEADING_LABEL, "").replace(UNLABELLED_FUNDING, "");

  let shown = base;
  if (base.length > PREVIEW_LENGTH) {
    const space = base.lastIndexOf(" ", PREVIEW_LENGTH);
    shown = `${base.slice(0, space > PREVIEW_LENGTH * 0.6 ? space : PREVIEW_LENGTH).replace(TRAILING_PUNCTUATION, "")}…`;
  }

  // Judged against what is actually SHOWN (not the whole abstract): a hit 500 characters in is not visible in a 200-character snippet.
  const needle = query.trim().toLowerCase();
  if (needle.length >= 2 && !shown.toLowerCase().includes(needle)) {
    const whole = tidy(trimmed);
    const hit = whole.toLowerCase().indexOf(needle);
    if (hit >= 0) {
      let start = Math.max(0, hit - WINDOW_AROUND_HIT);
      if (start > 0) start = whole.indexOf(" ", start) + 1 || start;
      let end = Math.min(whole.length, hit + needle.length + WINDOW_AROUND_HIT);
      if (end < whole.length) end = whole.lastIndexOf(" ", end) > hit + needle.length ? whole.lastIndexOf(" ", end) : end;
      return `${start > 0 ? "…" : ""}${whole.slice(start, end).replace(TRAILING_PUNCTUATION, "")}${end < whole.length ? "…" : ""}`;
    }
  }
  return shown;
}

export const PublicationRow = memo(function PublicationRow({
  publication,
  query = "",
  onOpen,
}: PublicationRowProps) {
  const preview = abstractPreview(publication.abstract, query);

  return (
    <button
      type="button"
      onClick={() => onOpen(publication)}
      className="flex w-full flex-col gap-4 border-b border-line px-2 py-6 text-left transition-colors hover:bg-text/[0.06] active:bg-text/[0.08] md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-medium leading-7 tracking-[-0.015em] text-text">
              {highlightText(displayTitle(publication.title), query)}
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
