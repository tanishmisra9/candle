/**
 * Trial detail dialog (portal). Fetches `GET /trials/{id}` when `trialId` is set.
 *
 * Can be covered by a `PublicationSnapshot` (`publicationSnapshotLayer`); only the topmost dialog has the focus trap, and the lower one gets `aria-hidden` + `inert`. Focus returns to the trigger on close, and body scroll is locked while open.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarRange, ExternalLink, Mail, MapPin, X } from "lucide-react";
import { createPortal } from "react-dom";

import { getTrial } from "../lib/api";
import { useFocusTrap } from "../lib/a11y";
import { overlayBackdropMotion, overlayPanelMotion } from "../lib/motion";
import clsx from "clsx";
import type { PublicationSummary } from "../types";
import { formatMonthYear, formatParticipants, formatSitesLabel } from "../lib/formatters";
import { useIsMobile } from "../lib/mobile";
import { lockPageScroll } from "../lib/scrollLock";
import { PhasePill } from "./PhasePill";
import { StackBackButton } from "./StackBackButton";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/Button";

const SNAPSHOT_SECTION_HEADING_CLASS =
  "text-[13px] font-medium kicker text-muted";
const AI_DISCLAIMER_COPY =
  "Written by AI from the ClinicalTrials.gov record, so it can contain mistakes. Always verify medical information with a qualified professional.";

function formatLocationLine(city?: string | null, country?: string | null) {
  const parts = [city, country].filter((value): value is string => Boolean(value?.trim()));
  return parts.join(", ");
}

/** "Dec 2011 to Jun 2015", or say what is missing instead of a bare "Unknown". */
function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${formatMonthYear(start)} to ${formatMonthYear(end)}`;
  if (start) return `Started ${formatMonthYear(start)} · no end date reported`;
  if (end) return `Ends ${formatMonthYear(end)} · no start date reported`;
  return "Dates not reported";
}

function formatMoreLocationsLabel(count: number) {
  return `Show ${count} more location${count === 1 ? "" : "s"}`;
}

function normalizeSummary(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type TrialSnapshotProps = {
  trialId: string | null;
  onClose: () => void;
  onOpenPublicationSnapshot: (publication: PublicationSummary) => void;
  isPublicationSnapshotOpen: boolean;
  publicationSnapshotLayer: "above-trial" | "below-trial";
  /** What this dialog is stacked on (e.g. "paper 123"), when something is underneath it. */
  underneath?: string;
};

export function TrialSnapshot({
  trialId,
  onClose,
  onOpenPublicationSnapshot,
  isPublicationSnapshotOpen,
  publicationSnapshotLayer,
  underneath,
}: TrialSnapshotProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [showAllLocations, setShowAllLocations] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const reactTitleId = useId();

  const isTopmost =
    Boolean(trialId) &&
    !(isPublicationSnapshotOpen && publicationSnapshotLayer === "above-trial");

  const detailQuery = useQuery({
    queryKey: ["trial", trialId],
    queryFn: () => getTrial(trialId as string),
    enabled: Boolean(trialId),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  useFocusTrap(dialogRef, isTopmost);

  useEffect(() => {
    if (!trialId) return;

    return lockPageScroll();
  }, [trialId]);

  useEffect(() => {
    if (!trialId || !isTopmost) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTopmost, onClose, trialId]);

  useEffect(() => {
    setShowAllLocations(false);
  }, [trialId]);

  useEffect(() => {
    if (!trialId) return;
    contentRef.current?.scrollTo({ top: 0 });
  }, [trialId]);

  useEffect(() => {
    if (trialId) {
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
  }, [trialId]);

  useEffect(() => {
    if (!trialId || !isTopmost) return;
    dialogRef.current?.focus();
  }, [isTopmost, trialId]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (!isTopmost) {
      node.setAttribute("inert", "");
    } else {
      node.removeAttribute("inert");
    }
  }, [isTopmost, trialId]);

  if (typeof document === "undefined") {
    return null;
  }

  const summary = normalizeSummary(detailQuery.data?.ai_summary);
  const titleText = trialId ? detailQuery.data?.title ?? "Loading trial details" : "";
  const titleId = trialId ? `trial-snapshot-title-${trialId}` : reactTitleId;
  const liveRegionAnnouncement = trialId
    ? detailQuery.data?.title
      ? `${detailQuery.data.title} details opened`
      : "Trial details opened"
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
          {trialId ? (
            <motion.div
              className="fixed inset-0 z-[60] flex items-end overflow-y-auto overscroll-contain bg-scrim/60 p-3 md:items-start md:justify-center md:px-6 md:pb-6 md:pt-16"
              initial={backdropMotion.initial}
              animate={backdropMotion.animate}
              exit={backdropMotion.exit}
              onClick={onClose}
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
                          {detailQuery.data?.id}
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
                        {titleText}
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      aria-label="Close trial details"
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
                  {detailQuery.isLoading || detailQuery.data ? (
                    <div className="grid gap-6 md:grid-cols-[1.25fr_0.75fr] md:gap-8">
                      <div className="space-y-6 md:space-y-8">
                        {detailQuery.data ? (
                          <div className="space-y-4">
                            {/* The header clamps the title to 3 lines on a phone; the whole title is repeated here (hidden from
                                assistive tech, the header's h2 already has it). */}
                            {isMobile ? (
                              <p aria-hidden="true" className="text-[18px] font-medium leading-[1.35] text-text">
                                {detailQuery.data.title}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusBadge status={detailQuery.data.status} />
                              <PhasePill phase={detailQuery.data.phase} />
                            </div>
                            <p className="text-[14px] leading-[1.5] text-muted">
                              {[
                                detailQuery.data.sponsor || "Unknown sponsor",
                                formatParticipants(detailQuery.data.enrollment),
                              ].join(" · ")}
                            </p>
                          </div>
                        ) : null}
                        <section className="rounded-panel border border-line bg-panel px-5 py-4">
                          <p className="text-[11px] kicker text-muted">
                            AI SUMMARY
                          </p>
                          <p className="mt-2 text-[12px] text-muted">{AI_DISCLAIMER_COPY}</p>
                          <div className="mt-3 min-h-[88px]">
                            {detailQuery.isLoading ? (
                              <p className="text-[14px] text-muted">Loading summary…</p>
                            ) : summary ? (
                              <p className="text-[16px] leading-[1.6] text-text">{summary}</p>
                            ) : (
                              <p className="text-[14px] text-muted">No summary available.</p>
                            )}
                          </div>
                        </section>
                        {detailQuery.data ? (
                          <>
                            <section className="space-y-3">
                              <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Snapshot</h3>
                              <p className="text-[15px] leading-[1.6] text-text">
                                {detailQuery.data.intervention ||
                                  "Intervention details not reported."}
                              </p>
                              <div className="grid gap-3 text-[14px] text-muted">
                                <div className="inline-flex items-center gap-2">
                                  <CalendarRange size={16} strokeWidth={1.5} />
                                  {formatDateRange(
                                    detailQuery.data.start_date,
                                    detailQuery.data.completion_date,
                                  )}
                                </div>
                                <div className="inline-flex items-center gap-2">
                                  <MapPin size={16} strokeWidth={1.5} />
                                  {formatSitesLabel(detailQuery.data.locations)}
                                </div>
                                {detailQuery.data.contact_email ? (
                                  <div className="inline-flex items-center gap-2">
                                    <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
                                    <a
                                      href={`mailto:${detailQuery.data.contact_email}`}
                                      className="underline underline-offset-2 hover:text-text"
                                    >
                                      {detailQuery.data.contact_email}
                                    </a>
                                  </div>
                                ) : null}
                              </div>
                              <a
                                href={detailQuery.data.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex w-fit items-center gap-2 min-h-11 rounded-panel border border-accent bg-accent/[0.12] px-4 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/[0.2]"
                              >
                                <ExternalLink
                                  size={14}
                                  strokeWidth={1.7}
                                  aria-hidden="true"
                                />
                                ClinicalTrials.gov
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                              {detailQuery.data.locations.length ? (
                                <div className="space-y-3 pt-2">
                                  <h4 className={SNAPSHOT_SECTION_HEADING_CLASS}>Locations</h4>
                                  <div className="space-y-2">
                                    {detailQuery.data.locations
                                      .slice(0, 3)
                                      .map((location, index) => {
                                        const locationLine = formatLocationLine(
                                          location.city,
                                          location.country,
                                        );
                                        const locationTitle =
                                          location.facility?.trim() ||
                                          locationLine ||
                                          `Location ${index + 1}`;

                                        return (
                                          <div
                                            key={`${locationTitle}-${index}`}
                                            className="rounded-panel border border-line px-4 py-3"
                                          >
                                            <p className="text-[14px] font-medium text-text">
                                              {locationTitle}
                                            </p>
                                            {location.facility?.trim() && locationLine ? (
                                              <p className="mt-1 text-[13px] text-muted">
                                                {locationLine}
                                              </p>
                                            ) : null}
                                            {location.status ? (
                                              <p className="mt-1 text-[13px] text-muted">
                                                {location.status}
                                              </p>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    <motion.div
                                      initial={false}
                                      animate={{
                                        height: showAllLocations ? "auto" : 0,
                                        opacity: showAllLocations ? 1 : 0,
                                        filter: showAllLocations ? "blur(0px)" : "blur(8px)",
                                      }}
                                      transition={{
                                        height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                                        opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                                        filter: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                                      }}
                                      className="overflow-hidden"
                                      style={{ pointerEvents: showAllLocations ? "auto" : "none" }}
                                    >
                                      <div className="space-y-2 pt-2">
                                        {detailQuery.data.locations
                                          .slice(3)
                                          .map((location, index) => {
                                            const locationLine = formatLocationLine(
                                              location.city,
                                              location.country,
                                            );
                                            const locationTitle =
                                              location.facility?.trim() ||
                                              locationLine ||
                                              `Location ${index + 4}`;

                                            return (
                                              <div
                                                key={`${locationTitle}-${index + 3}`}
                                                className="rounded-panel border border-line px-4 py-3"
                                              >
                                                <p className="text-[14px] font-medium text-text">
                                                  {locationTitle}
                                                </p>
                                                {location.facility?.trim() && locationLine ? (
                                                  <p className="mt-1 text-[13px] text-muted">
                                                    {locationLine}
                                                  </p>
                                                ) : null}
                                                {location.status ? (
                                                  <p className="mt-1 text-[13px] text-muted">
                                                    {location.status}
                                                  </p>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </motion.div>
                                  </div>
                                  {detailQuery.data.locations.length > 3 ? (
                                    <button
                                      type="button"
                                      onClick={() => setShowAllLocations((current) => !current)}
                                      className="inline-flex min-h-11 items-center text-[14px] text-muted transition-colors hover:text-text"
                                    >
                                      {showAllLocations
                                        ? "Show fewer locations"
                                        : formatMoreLocationsLabel(
                                            detailQuery.data.locations.length - 3,
                                          )}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </section>

                            <section className="space-y-3">
                              <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Outcomes</h3>
                              <div className="space-y-3">
                                {detailQuery.data.outcomes.length ? (
                                  detailQuery.data.outcomes.map((outcome, index) => (
                                    <div
                                      key={`${outcome.outcome_type}-${index}`}
                                      className="rounded-panel border border-line p-4"
                                    >
                                      <p className="text-[12px] kicker text-muted">
                                        {outcome.outcome_type}
                                      </p>
                                      <p className="mt-2 text-[15px] font-medium text-text">
                                        {outcome.measure}
                                      </p>
                                      {outcome.timeframe ? (
                                        <p className="mt-1 text-[13px] text-muted">
                                          {outcome.timeframe}
                                        </p>
                                      ) : null}
                                      {outcome.description ? (
                                        <p className="mt-2 text-[14px] leading-6 text-muted">
                                          {outcome.description}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[14px] text-muted">
                                    No structured outcomes were available in the upstream record.
                                  </p>
                                )}
                              </div>
                            </section>
                          </>
                        ) : (
                          <p className="text-[14px] text-muted">Loading trial details…</p>
                        )}
                      </div>

                      <aside className="space-y-3">
                        {detailQuery.data ? (
                          <>
                            <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Linked Literature</h3>
                            <div className="space-y-3">
                              {detailQuery.data.publications.length ? (
                                detailQuery.data.publications.map((publication) => (
                                  <button
                                    type="button"
                                    key={publication.pmid}
                                    onClick={() => onOpenPublicationSnapshot(publication)}
                                    className="block w-full rounded-panel border border-line p-4 text-left transition hover:border-accent/[0.22]"
                                  >
                                    <p className="text-[15px] font-medium leading-6 text-text">
                                      {publication.title}
                                    </p>
                                    <p className="mt-2 text-[13px] text-muted">
                                      {publication.authors[0]?.split(",")[0] ?? "Unknown author"}{" "}
                                      et al.
                                      {publication.pub_date
                                        ? `, ${publication.pub_date.slice(0, 4)}`
                                        : ""}
                                    </p>
                                  </button>
                                ))
                              ) : (
                                <p className="text-[14px] text-muted">
                                  No linked publications yet for this trial.
                                </p>
                              )}
                            </div>
                          </>
                        ) : null}
                      </aside>
                    </div>
                  ) : (
                    <p className="text-[14px] text-muted">Trial details could not be loaded.</p>
                  )}
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
