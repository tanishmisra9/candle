import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, X } from "lucide-react";
import { createPortal } from "react-dom";

import { getPublicationOverview } from "../lib/api";
import type { PublicationSummary } from "../types";
import { Button } from "./ui/Button";

type PublicationOverviewState = {
  status: "idle" | "loading" | "success" | "error";
  overview: string | null;
};

type PublicationSnapshotLayer = "above-trial" | "below-trial";

type PublicationSnapshotProps = {
  publication: PublicationSummary | null;
  onClose: () => void;
  onOpenTrialSnapshot: (trialId: string) => void;
  layer: PublicationSnapshotLayer;
  isTrialSnapshotOpen: boolean;
};

function formatPublicationDate(value: string | null) {
  if (!value) return "Unknown date";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatPublicationAuthors(publication: PublicationSummary) {
  const leadAuthor = publication.authors[0]?.split(",")[0] ?? "Unknown author";
  const year = publication.pub_date?.slice(0, 4) ?? "n.d.";
  return `${leadAuthor} et al., ${year}`;
}

export function PublicationSnapshot({
  publication,
  onClose,
  onOpenTrialSnapshot,
  layer,
  isTrialSnapshotOpen,
}: PublicationSnapshotProps) {
  const [overviewCache, setOverviewCache] = useState<Map<string, PublicationOverviewState>>(
    () => new Map(),
  );
  const overviewCacheRef = useRef(overviewCache);

  useEffect(() => {
    overviewCacheRef.current = overviewCache;
  }, [overviewCache]);

  useEffect(() => {
    if (!publication) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [publication]);

  const isTopmost = Boolean(publication) && (!isTrialSnapshotOpen || layer === "above-trial");

  useEffect(() => {
    if (!publication || !isTopmost) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTopmost, onClose, publication]);

  const selectedOverview = publication
    ? overviewCache.get(publication.pmid) ??
      (publication.abstract?.trim()
        ? { status: "loading" as const, overview: null }
        : { status: "success" as const, overview: null })
    : undefined;

  useEffect(() => {
    if (!publication) return;

    const pmid = publication.pmid;
    const currentOverview = overviewCacheRef.current.get(pmid);
    const normalizedAbstract = publication.abstract?.trim();

    if (!normalizedAbstract) {
      if (!currentOverview) {
        setOverviewCache((current) => {
          const next = new Map(current);
          next.set(pmid, { status: "success", overview: null });
          return next;
        });
      }
      return;
    }

    if (currentOverview && currentOverview.status !== "idle") {
      return;
    }

    setOverviewCache((current) => {
      const next = new Map(current);
      next.set(pmid, { status: "loading", overview: null });
      return next;
    });

    let cancelled = false;

    void getPublicationOverview(pmid)
      .then((response) => {
        if (cancelled) return;
        setOverviewCache((current) => {
          const next = new Map(current);
          next.set(pmid, { status: "success", overview: response.overview });
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setOverviewCache((current) => {
          const next = new Map(current);
          next.set(pmid, { status: "error", overview: null });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [publication]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {publication ? (
        <motion.div
          className={`fixed inset-0 ${
            layer === "above-trial" ? "z-[70]" : "z-50"
          } flex items-end overflow-y-auto bg-[rgba(11,11,15,0.28)] p-4 backdrop-blur-sm md:items-start md:justify-center md:px-6 md:pb-6 md:pt-16`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isTopmost ? onClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[min(88vh,920px)] w-full flex-col overflow-hidden rounded-[30px] border border-line bg-panel shadow-panel md:h-[min(calc(100vh-7rem),920px)] md:max-w-[1040px]"
          >
            <div className="border-b border-line bg-panel/92 px-6 pb-5 pt-6 backdrop-blur-xl md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[820px]">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-muted">
                    PMID {publication.pmid}
                  </p>
                  <h2 className="mt-2 text-[28px] font-medium tracking-[-0.03em] text-text md:text-[32px]">
                    {publication.title}
                  </h2>
                </div>
                <Button variant="ghost" onClick={onClose}>
                  <X size={18} strokeWidth={1.5} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 md:px-8 md:pb-8">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <section className="rounded-card border border-line bg-glass px-5 py-4 shadow-panel">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                      Overview
                    </p>
                    <p className="mt-2 text-[12px] text-muted">
                      This is AI-generated. Always verify medical information with a qualified
                      professional.
                    </p>
                    <div className="mt-3 min-h-[88px]">
                      {selectedOverview?.status === "loading" ? (
                        <p className="text-[14px] text-muted">Generating summary…</p>
                      ) : null}
                      {selectedOverview?.status === "error" ? (
                        <p className="text-[14px] text-muted">Overview unavailable right now.</p>
                      ) : null}
                      {selectedOverview?.status === "success" && selectedOverview.overview ? (
                        <p className="text-[16px] leading-[1.6] text-text">
                          {selectedOverview.overview}
                        </p>
                      ) : null}
                      {selectedOverview?.status === "success" && !selectedOverview.overview ? (
                        <p className="text-[14px] text-muted">No summary available.</p>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-card border border-line bg-panel px-5 py-4 shadow-panel">
                    <h3 className="text-[11px] uppercase tracking-[0.24em] text-muted">
                      Abstract
                    </h3>
                    {publication.abstract?.trim() ? (
                      <p className="mt-3 text-[14px] leading-[1.6] text-text/92">
                        {publication.abstract.trim()}
                      </p>
                    ) : (
                      <p className="mt-3 text-[14px] text-muted">No abstract available.</p>
                    )}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-card border border-line bg-panel px-5 py-4 shadow-panel">
                    <h3 className="text-[11px] uppercase tracking-[0.24em] text-muted">
                      Snapshot
                    </h3>
                    <div className="mt-3 space-y-2.5 text-[14px] text-muted">
                      <p>{formatPublicationAuthors(publication)}</p>
                      <p>{publication.journal || "Journal not listed"}</p>
                      <div className="inline-flex items-center gap-2">
                        <CalendarRange size={16} strokeWidth={1.5} />
                        {formatPublicationDate(publication.pub_date)}
                      </div>
                      {publication.trial_id ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenTrialSnapshot(publication.trial_id as string)}
                            className="inline-flex rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.12)] px-3.5 py-1.5 text-[13px] text-accent transition hover:bg-[rgba(232,163,61,0.18)]"
                          >
                            {publication.trial_id}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <a
                    href={publication.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-[14px] text-muted transition hover:text-text"
                  >
                    Read on PubMed
                  </a>
                </aside>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
