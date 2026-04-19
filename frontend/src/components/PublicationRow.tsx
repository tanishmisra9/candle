import { motion, useReducedMotion } from "framer-motion";

import type { PublicationSummary } from "../types";

type PublicationRowProps = {
  publication: PublicationSummary;
  onOpen: () => void;
};

function formatAuthors(publication: PublicationSummary) {
  const leadAuthor = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return `${leadAuthor} et al., ${year}`;
}

export function PublicationRow({ publication, onOpen }: PublicationRowProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={prefersReducedMotion ? undefined : { y: -1, transition: { duration: 0.2 } }}
      className="flex w-full flex-col gap-4 border-b border-line px-2 py-6 text-left transition hover:bg-[rgba(0,0,0,0.015)] dark:hover:bg-[rgba(255,255,255,0.02)] md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-[19px] font-medium leading-7 tracking-[-0.015em] text-text">
              {publication.title}
            </h3>
            <p className="mt-2 text-[15px] text-muted">{formatAuthors(publication)}</p>
            <p className="mt-1.5 text-[15px] italic text-muted">
              {publication.journal || "Journal not listed"}
            </p>
          </div>
        </div>
      </div>

      {publication.trial_id ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.12)] px-3.5 py-1.5 text-[13px] text-accent">
            {publication.trial_id}
          </span>
        </div>
      ) : null}
    </motion.button>
  );
}
