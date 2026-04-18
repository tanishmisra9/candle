import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink } from "lucide-react";

import { getPublicationOverview } from "../lib/api";
import { cn } from "../lib/cn";
import type { PublicationSummary } from "../types";


export type PublicationOverviewState = {
  status: "idle" | "loading" | "success" | "error";
  overview: string | null;
};

type PublicationRowProps = {
  publication: PublicationSummary;
  isExpanded: boolean;
  onToggle: () => void;
  overviewCache?: Map<string, PublicationOverviewState>;
  onOverviewLoad?: (pmid: string, state: PublicationOverviewState) => void;
  onOpenTrialSnapshot?: (trialId: string) => void;
};

const expandTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

function formatAuthors(publication: PublicationSummary) {
  const leadAuthor = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return `${leadAuthor} et al., ${year}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      <div className="h-3 w-4/5 rounded-full bg-[rgba(232,163,61,0.14)]" />
      <div className="h-3 w-full rounded-full bg-[rgba(232,163,61,0.1)]" />
      <div className="h-3 w-3/4 rounded-full bg-[rgba(232,163,61,0.08)]" />
    </div>
  );
}

export function PublicationRow({
  publication,
  isExpanded,
  onToggle,
  overviewCache,
  onOverviewLoad,
  onOpenTrialSnapshot,
}: PublicationRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const overviewState = overviewCache?.get(publication.pmid);

  useEffect(() => {
    if (!isExpanded || !onOverviewLoad) {
      return;
    }

    if (!publication.abstract?.trim()) {
      if (!overviewState) {
        onOverviewLoad(publication.pmid, { status: "success", overview: null });
      }
      return;
    }

    if (overviewState && overviewState.status !== "idle") {
      return;
    }

    onOverviewLoad(publication.pmid, { status: "loading", overview: null });

    void getPublicationOverview(publication.pmid)
      .then((response) => {
        onOverviewLoad(publication.pmid, {
          status: "success",
          overview: response.overview,
        });
      })
      .catch(() => {
        onOverviewLoad(publication.pmid, { status: "error", overview: null });
      });
  }, [isExpanded, onOverviewLoad, overviewState, publication.abstract, publication.pmid]);

  return (
    <article className="border-b border-line px-2">
      <motion.button
        type="button"
        onClick={onToggle}
        whileHover={prefersReducedMotion ? undefined : { y: -1, transition: { duration: 0.2 } }}
        className="flex w-full flex-col gap-4 py-6 text-left transition hover:bg-[rgba(0,0,0,0.015)] dark:hover:bg-[rgba(255,255,255,0.02)] md:flex-row md:items-start md:justify-between"
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

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, height: "auto", y: 0 }
            }
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            transition={expandTransition}
            className="overflow-hidden pb-6"
          >
            <div className="grid gap-4 rounded-card border border-line bg-panel p-5 shadow-panel md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <section className="rounded-xl border border-[rgba(232,163,61,0.15)] bg-[rgba(232,163,61,0.06)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                    AI Overview
                  </p>
                  <div className="mt-3 space-y-3">
                    {overviewState?.status === "loading" ? (
                      <LoadingSkeleton />
                    ) : overviewState?.status === "success" && overviewState.overview ? (
                      <p className="text-[15px] leading-relaxed text-text">
                        {overviewState.overview}
                      </p>
                    ) : overviewState?.status === "error" ? (
                      <p className="text-[14px] text-muted">
                        AI overview unavailable right now.
                      </p>
                    ) : (
                      <p className="text-[14px] text-muted">No AI overview available.</p>
                    )}
                    <p className="text-[12px] italic text-muted">
                      AI-generated summary. Always verify with the original source.
                    </p>
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Abstract</p>
                  {publication.abstract?.trim() ? (
                    <p className="text-[15px] leading-relaxed text-muted">
                      {publication.abstract.trim()}
                    </p>
                  ) : (
                    <p className="text-[15px] text-muted">No abstract available.</p>
                  )}
                </section>
              </div>

              <aside className="flex flex-col gap-3">
                <a
                  href={publication.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-muted transition hover:text-text"
                >
                  Read on PubMed
                  <ExternalLink size={15} strokeWidth={1.5} />
                </a>

                {publication.trial_id ? (
                  <button
                    type="button"
                    onClick={() => onOpenTrialSnapshot?.(publication.trial_id as string)}
                    className={cn(
                      "inline-flex w-fit items-center rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.12)] px-3.5 py-1.5 text-[13px] text-accent transition",
                      onOpenTrialSnapshot && "hover:bg-[rgba(232,163,61,0.18)]",
                    )}
                  >
                    {publication.trial_id}
                  </button>
                ) : null}
              </aside>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
