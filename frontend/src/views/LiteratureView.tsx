import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

import {
  PublicationRow,
  type PublicationOverviewState,
} from "../components/PublicationRow";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";
import { getPublicationOverview, listPublications } from "../lib/api";
import type { PublicationSummary } from "../types";

type LiteratureViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
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

export function LiteratureView({
  onOpenTrialSnapshot,
  isTrialSnapshotOpen,
}: LiteratureViewProps) {
  const pageSize = 50;
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [compactControls, setCompactControls] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPublication, setSelectedPublication] = useState<PublicationSummary | null>(null);
  const [overviewCache, setOverviewCache] = useState<Map<string, PublicationOverviewState>>(
    () => new Map(),
  );
  const skipInitialPublicationReset = useRef(true);
  const overviewCacheRef = useRef(overviewCache);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [searchParams, setSearchParams] = useSearchParams();
  const publicationRoutePmid = searchParams.get("pmid");

  function syncPublicationRoute(pmid: string | null, replace = false) {
    const next = new URLSearchParams(window.location.search);
    if (pmid) {
      next.set("pmid", pmid);
    } else {
      next.delete("pmid");
    }
    setSearchParams(next, { replace });
  }

  function openPublicationSnapshot(publication: PublicationSummary) {
    setSelectedPublication(publication);
    if (publicationRoutePmid !== publication.pmid) {
      syncPublicationRoute(publication.pmid);
    }
  }

  function closePublicationSnapshot() {
    setSelectedPublication(null);
    if (publicationRoutePmid) {
      syncPublicationRoute(null, true);
    }
  }

  useEffect(() => {
    overviewCacheRef.current = overviewCache;
  }, [overviewCache]);

  useEffect(() => {
    let lastValue = 0;
    return scrollY.on("change", (value) => {
      const goingDown = value > lastValue;
      if (value < 90) {
        setCompactControls(false);
      } else if (goingDown && value > 180) {
        setCompactControls(true);
      } else if (!goingDown) {
        setCompactControls(false);
      }
      lastValue = value;
    });
  }, [scrollY]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const publicationsQuery = useQuery({
    queryKey: ["publications", deferredSearch],
    queryFn: () =>
      listPublications({
        q: deferredSearch || undefined,
        limit: 500,
      }),
  });

  const publications = (publicationsQuery.data ?? []).filter((item) =>
    linkedOnly ? Boolean(item.trial_id) : true,
  );
  const totalPages = Math.max(1, Math.ceil(publications.length / pageSize));
  const contentReady = publicationsQuery.isFetched;
  const startupReveal = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, filter: "blur(14px)" },
        animate: contentReady
          ? { opacity: 1, filter: "blur(0px)" }
          : { opacity: 0, filter: "blur(14px)" },
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
      };
  const paginatedPublications = publications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, linkedOnly]);

  useEffect(() => {
    if (!publicationRoutePmid) return;

    const publication = (publicationsQuery.data ?? []).find(
      (item) => item.pmid === publicationRoutePmid,
    );
    if (!publication) return;

    setSelectedPublication((current) =>
      current?.pmid === publication.pmid ? current : publication,
    );
  }, [publicationRoutePmid, publicationsQuery.data]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (skipInitialPublicationReset.current) {
      skipInitialPublicationReset.current = false;
      return;
    }

    closePublicationSnapshot();
  }, [currentPage, deferredSearch, linkedOnly]);

  useEffect(() => {
    if (!selectedPublication) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPublication]);

  useEffect(() => {
    if (!selectedPublication) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isTrialSnapshotOpen) {
        closePublicationSnapshot();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTrialSnapshotOpen, selectedPublication]);

  const selectedOverview = selectedPublication
    ? overviewCache.get(selectedPublication.pmid) ??
      (selectedPublication.abstract?.trim()
        ? { status: "loading" as const, overview: null }
        : { status: "success" as const, overview: null })
    : undefined;

  useEffect(() => {
    if (!selectedPublication) return;

    const pmid = selectedPublication.pmid;
    const currentOverview = overviewCacheRef.current.get(pmid);
    const normalizedAbstract = selectedPublication.abstract?.trim();

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
  }, [selectedPublication]);

  const publicationSnapshot =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {selectedPublication ? (
              <motion.div
                className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-[rgba(11,11,15,0.28)] p-4 backdrop-blur-sm md:items-start md:justify-center md:px-6 md:pb-6 md:pt-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closePublicationSnapshot}
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
                          PMID {selectedPublication.pmid}
                        </p>
                        <h2 className="mt-2 text-[28px] font-medium tracking-[-0.03em] text-text md:text-[32px]">
                          {selectedPublication.title}
                        </h2>
                      </div>
                      <Button variant="ghost" onClick={closePublicationSnapshot}>
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
                            This is AI-generated. Always verify medical information with a
                            qualified professional.
                          </p>
                          <div className="mt-3 min-h-[88px]">
                            {selectedOverview?.status === "loading" ? (
                              <p className="text-[14px] text-muted">Generating summary…</p>
                            ) : null}
                            {selectedOverview?.status === "error" ? (
                              <p className="text-[14px] text-muted">
                                Overview unavailable right now.
                              </p>
                            ) : null}
                            {selectedOverview?.status === "success" &&
                            selectedOverview.overview ? (
                              <p className="text-[16px] leading-7 text-text">
                                {selectedOverview.overview}
                              </p>
                            ) : null}
                            {selectedOverview?.status === "success" &&
                            !selectedOverview.overview ? (
                              <p className="text-[14px] text-muted">No summary available.</p>
                            ) : null}
                          </div>
                        </section>

                        <section className="rounded-card border border-line bg-panel px-5 py-4 shadow-panel">
                          <h3 className="text-[11px] uppercase tracking-[0.24em] text-muted">
                            Abstract
                          </h3>
                          {selectedPublication.abstract?.trim() ? (
                            <p className="mt-3 text-[14px] leading-7 text-text/92">
                              {selectedPublication.abstract.trim()}
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
                            <p>{formatPublicationAuthors(selectedPublication)}</p>
                            <p>{selectedPublication.journal || "Journal not listed"}</p>
                            <div className="inline-flex items-center gap-2">
                              <CalendarRange size={16} strokeWidth={1.5} />
                              {formatPublicationDate(selectedPublication.pub_date)}
                            </div>
                            {selectedPublication.trial_id ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenTrialSnapshot(selectedPublication.trial_id as string)
                                  }
                                  className="inline-flex rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.12)] px-3.5 py-1.5 text-[13px] text-accent transition hover:bg-[rgba(232,163,61,0.18)]"
                                >
                                  {selectedPublication.trial_id}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <a
                          href={selectedPublication.url}
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
        )
      : null;

  return (
    <div className="space-y-12 pb-20 pt-32">
      <motion.header
        className="space-y-2"
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Publications</p>
        <h1 className="text-[38px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {publications.length} publications tracked
        </h1>
      </motion.header>

      <motion.div
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
        className="space-y-12"
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: compactControls ? -4 : 0,
                  paddingTop: compactControls ? 10 : 16,
                  paddingBottom: compactControls ? 10 : 16,
                }
          }
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="glass-nav sticky top-[94px] z-30 flex w-full flex-col gap-4 rounded-[24px] px-5 md:w-fit md:self-start md:px-4"
        >
          <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-3">
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: compactControls ? 0.985 : 1,
                    }
              }
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="relative w-full md:w-[420px]"
            >
              <Search
                size={17}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or abstract"
                className={cn(
                  "w-full rounded-full border border-line bg-glass pl-11 pr-14 text-[14px] text-text shadow-panel outline-none backdrop-blur-2xl placeholder:text-muted transition-all focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  "text-[16px]",
                  compactControls ? "py-3" : "py-3.5",
                )}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
                ⌘K
              </span>
            </motion.div>

            <div className="inline-flex self-start rounded-full border border-line bg-glass p-1 backdrop-blur-2xl md:self-auto">
              <button
                type="button"
                onClick={() => setLinkedOnly((current) => !current)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-[14px] font-medium transition",
                  linkedOnly
                    ? "bg-[rgba(232,163,61,0.14)] text-text"
                    : "text-muted",
                )}
                aria-pressed={linkedOnly}
              >
                Linked
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${linkedOnly ? "linked" : "all"}-${currentPage}`}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-card border border-line bg-panel px-8 shadow-panel"
          >
            {paginatedPublications.map((publication) => (
              <PublicationRow
                key={publication.pmid}
                publication={publication}
                onOpen={() => openPublicationSnapshot(publication)}
              />
            ))}
            {!publications.length ? (
              <div className="px-2 py-12 text-[15px] text-muted">
                No publications matched this filter.
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {publications.length ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-glass text-text shadow-panel backdrop-blur-2xl transition",
                currentPage === 1
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-[rgba(255,255,255,0.06)]",
              )}
              aria-label="Previous page"
            >
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>
            <p className="min-w-[90px] text-center text-[14px] text-muted">
              {currentPage} / {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-glass text-text shadow-panel backdrop-blur-2xl transition",
                currentPage === totalPages
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-[rgba(255,255,255,0.06)]",
              )}
              aria-label="Next page"
            >
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
        ) : null}
      </motion.div>
      {publicationSnapshot}
    </div>
  );
}
