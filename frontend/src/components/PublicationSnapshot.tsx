/** Publication reader dialog (portal): abstract, linked trial and a persisted AI overview fetched via `POST /publications/{pmid}/overview`. Same stacking, focus-trap and focus-return rules as `TrialSnapshot`. */
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarRange, ExternalLink, X } from "lucide-react";
import { createPortal } from "react-dom";

import { getPublicationOverview } from "../lib/api";
import { useFocusTrap } from "../lib/a11y";
import { overlayBackdropMotion, overlayPanelMotion } from "../lib/motion";
import clsx from "clsx";
import { useIsMobile } from "../lib/mobile";
import { lockPageScroll } from "../lib/scrollLock";
import type { PublicationSummary } from "../types";
import { StackBackButton } from "./StackBackButton";
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
  /** What this dialog is stacked on (e.g. "trial NCT123"), when something is underneath it. */
  underneath?: string;
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

function PubMedLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-2 min-h-11 rounded-panel border border-accent bg-accent/[0.12] px-4 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/[0.2]"
    >
      <ExternalLink size={14} strokeWidth={1.7} aria-hidden="true" />
      Read on PubMed
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function PublicationSnapshot({
  publication,
  onClose,
  onOpenTrialSnapshot,
  layer,
  isTrialSnapshotOpen,
  underneath,
}: PublicationSnapshotProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [overviewCache, setOverviewCache] = useState<Map<string, PublicationOverviewState>>(
    () => new Map(),
  );
  // Bumped by "Try again" to re-run the overview fetch for the open paper.
  const [overviewAttempt, setOverviewAttempt] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const reactTitleId = useId();
  const overviewCacheRef = useRef(overviewCache);

  useEffect(() => {
    overviewCacheRef.current = overviewCache;
  }, [overviewCache]);

  useEffect(() => {
    if (!publication) return;

    return lockPageScroll();
  }, [publication]);

  const isTopmost = Boolean(publication) && (!isTrialSnapshotOpen || layer === "above-trial");

  useFocusTrap(dialogRef, isTopmost);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (!isTopmost) {
      node.setAttribute("inert", "");
    } else {
      node.removeAttribute("inert");
    }
  }, [isTopmost, publication]);

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
      // Closed (or switched paper) before the answer landed: forget the "loading" entry. Left in the cache it
      // blocked every later open, which then said "Generating summary…" forever because nothing was in flight.
      setOverviewCache((current) => {
        if (current.get(pmid)?.status !== "loading") return current;
        const next = new Map(current);
        next.delete(pmid);
        return next;
      });
    };
  }, [publication, overviewAttempt]);

  function retryOverview(pmid: string) {
    setOverviewCache((current) => {
      const next = new Map(current);
      next.delete(pmid);
      return next;
    });
    setOverviewAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    if (!publication) return;
    contentRef.current?.scrollTo({ top: 0 });
  }, [publication]);

  useEffect(() => {
    if (publication) {
      if (!wasOpenRef.current) {
        triggerRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      wasOpenRef.current = true;
      return;
    }

    if (wasOpenRef.current) {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }

    wasOpenRef.current = false;
  }, [publication]);

  useEffect(() => {
    if (!publication || !isTopmost) return;
    dialogRef.current?.focus();
  }, [isTopmost, publication]);

  if (typeof document === "undefined") {
    return null;
  }

  const titleId = publication
    ? `publication-snapshot-title-${publication.pmid}`
    : reactTitleId;
  const liveRegionAnnouncement = publication
    ? `${publication.title} details opened`
    : "";
  const backdropMotion = overlayBackdropMotion(prefersReducedMotion);
  const panelMotion = overlayPanelMotion(prefersReducedMotion);

  return (
    <>
      <span className="sr-only" aria-live="assertive" aria-atomic="true">
        {liveRegionAnnouncement}
      </span>
      {createPortal(
    <AnimatePresence>
      {publication ? (
        <motion.div
          className={`fixed inset-0 ${
            layer === "above-trial" ? "z-[70]" : "z-50"
          } flex items-end overflow-y-auto overscroll-contain bg-scrim/60 p-3 md:items-start md:justify-center md:px-6 md:pb-6 md:pt-16`}
          initial={backdropMotion.initial}
          animate={backdropMotion.animate}
          exit={backdropMotion.exit}
          onClick={isTopmost ? onClose : undefined}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-hidden={!isTopmost ? true : undefined}
            tabIndex={-1}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            onClick={(event) => event.stopPropagation()}
            className="relative flex h-[min(87svh,920px)] w-full flex-col overflow-hidden rounded-panel border border-line bg-panel md:h-[min(calc(100vh-7rem),920px)] md:max-w-[1040px] md:rounded-panel"
          >
            <div data-testid="snapshot-header" className="border-b border-line bg-panel px-5 pt-6 pb-5 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 max-w-[820px] flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
                    <p className="whitespace-nowrap text-[11px] kicker text-muted md:text-[12px]">
                      PMID {publication.pmid}
                    </p>
                    {underneath ? <StackBackButton label={underneath} onBack={onClose} /> : null}
                  </div>
                  <h2
                    id={titleId}
                    className={clsx(
                      "mt-2 font-medium tracking-[-0.03em] text-text md:text-[32px]",
                      isMobile ? "line-clamp-3 text-[26px] leading-[1.12]" : "text-[32px]",
                    )}
                  >
                    {publication.title}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  aria-label="Close publication details"
                  className="shrink-0 self-start min-h-12 min-w-12 p-0"
                >
                  <X size={18} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div
              ref={contentRef}
              data-testid="snapshot-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5 md:px-8 md:pb-8 md:pt-6"
            >
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:gap-6">
                <div className="space-y-5">
                  {isMobile ? (
                    <div className="space-y-3">
                      {/* The header clamps the title to 3 lines on a phone: repeat it whole (hidden from assistive tech,
                          the h2 has it), then the source link, which used to sit below the whole abstract. */}
                      <p aria-hidden="true" className="text-[18px] font-medium leading-[1.35] text-text">
                        {publication.title}
                      </p>
                      <p className="text-[14px] text-muted">
                        {[publication.journal || "Journal not listed", formatPublicationDate(publication.pub_date)].join(" · ")}
                      </p>
                      <PubMedLink url={publication.url} />
                    </div>
                  ) : null}
                  <section className="rounded-panel border border-line bg-panel px-5 py-4">
                    <p className="text-[11px] kicker text-muted">
                      AI summary
                    </p>
                    <p className="mt-2 text-[12px] text-muted">
                      Plain-language summary of the abstract below, written by AI. It can contain
                      mistakes. Always verify medical information with a qualified professional.
                    </p>
                    <div className="mt-3 min-h-[88px]">
                      {selectedOverview?.status === "loading" ? (
                        <p className="text-[14px] text-muted">Generating summary…</p>
                      ) : null}
                      {selectedOverview?.status === "error" ? (
                        <div role="status" aria-live="polite" className="space-y-3">
                          <p className="text-[14px] text-muted">Summary unavailable right now.</p>
                          <Button variant="secondary" onClick={() => retryOverview(publication.pmid)}>
                            Try again
                          </Button>
                        </div>
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

                  <section className="rounded-panel border border-line bg-panel px-5 py-4">
                    <h3 className="text-[11px] kicker text-muted">
                      Abstract
                    </h3>
                    {publication.abstract?.trim() ? (
                      <p className="mt-3 text-[15px] leading-[1.6] text-text">
                        {publication.abstract.trim()}
                      </p>
                    ) : (
                      <p className="mt-3 text-[14px] text-muted">No abstract available.</p>
                    )}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-panel border border-line bg-panel px-5 py-4">
                    <h3 className="text-[11px] kicker text-muted">
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
                            className="kicker inline-flex min-h-11 items-center rounded-panel border border-accent bg-accent/[0.12] px-3 text-[12px] text-accent transition-colors hover:bg-accent/[0.2]"
                          >
                            {publication.trial_id}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {isMobile ? null : <PubMedLink url={publication.url} />}
                </aside>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
      )}
    </>
  );
}
