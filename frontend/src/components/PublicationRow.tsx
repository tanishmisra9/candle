import { ExternalLink } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import type { PublicationSummary } from "../types";

function formatAuthors(publication: PublicationSummary) {
  const leadAuthor = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return `${leadAuthor} et al., ${year}`;
}

export function PublicationRow({ publication }: { publication: PublicationSummary }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.a
      href={publication.url}
      target="_blank"
      rel="noreferrer"
      whileHover={prefersReducedMotion ? undefined : { y: -1, transition: { duration: 0.2 } }}
      className="flex flex-col gap-3 border-b border-line px-1 py-5 transition hover:bg-[rgba(0,0,0,0.015)] dark:hover:bg-[rgba(255,255,255,0.02)] md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-text">
              {publication.title}
            </h3>
            <p className="mt-2 text-[14px] text-muted">{formatAuthors(publication)}</p>
            <p className="mt-1 text-[14px] italic text-muted">
              {publication.journal || "Journal not listed"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {publication.trial_id ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.12)] px-3 py-1 text-[12px] text-accent">
            {publication.trial_id} →
          </span>
        ) : null}
        <ExternalLink size={16} strokeWidth={1.5} className="text-muted" />
      </div>
    </motion.a>
  );
}
