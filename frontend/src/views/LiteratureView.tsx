import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PublicationRow } from "../components/PublicationRow";
import { PublicationRowSkeleton } from "../components/PublicationRowSkeleton";
import { cn } from "../lib/cn";
import { listPublications } from "../lib/api";
import { NAV_OFFSET_CLASS, useIsMobile, useScrollVisibilityState } from "../lib/mobile";
import type { PublicationSummary } from "../types";

type LiteratureViewProps = {
  onOpenPublicationSnapshot: (publication: PublicationSummary) => void;
};

export function LiteratureView({ onOpenPublicationSnapshot }: LiteratureViewProps) {
  const pageSize = 50;
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const isControlsVisible = useScrollVisibilityState({
    enabled: isMobile,
    hideAfter: 140,
    revealWithin: 72,
  });

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
  const showPublicationSkeletons = publicationsQuery.isLoading;
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
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const controlsAnimate = prefersReducedMotion
    ? undefined
    : isMobile
      ? {
          y: isControlsVisible ? 0 : -18,
          opacity: isControlsVisible ? 1 : 0,
          scale: isControlsVisible ? 1 : 0.985,
          filter: isControlsVisible ? "blur(0px)" : "blur(8px)",
        }
      : undefined;

  return (
    <div className="space-y-8 pb-20 pt-28 md:space-y-12 md:pt-32">
      <motion.header
        className="space-y-2"
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Publications</p>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {publications.length} publications tracked
        </h1>
      </motion.header>

      <motion.div
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
        className="space-y-8 md:space-y-12"
      >
        <div
          className={cn(
            "glass-nav sticky z-30 flex w-full flex-col gap-4 rounded-[24px] px-4 py-4 md:w-fit md:self-start md:px-4",
            NAV_OFFSET_CLASS,
            isMobile && !isControlsVisible && "pointer-events-none",
          )}
        >
          <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-3">
            <div className="relative w-full md:w-[420px]">
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
                  "py-3.5",
                )}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
                ⌘K
              </span>
            </div>

            <div className="inline-flex self-start rounded-full border border-line bg-glass p-1 backdrop-blur-2xl md:self-auto">
              <button
                type="button"
                onClick={() => setLinkedOnly((current) => !current)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-[14px] font-medium transition",
                  linkedOnly ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
                )}
                aria-pressed={linkedOnly}
              >
                Linked
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${linkedOnly ? "linked" : "all"}-${currentPage}`}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-card border border-line bg-panel px-4 shadow-panel md:px-8"
          >
            {showPublicationSkeletons
              ? Array.from({ length: 8 }).map((_, index) => (
                  <PublicationRowSkeleton key={`publication-skeleton-${index}`} />
                ))
              : paginatedPublications.map((publication) => (
                  <PublicationRow
                    key={publication.pmid}
                    publication={publication}
                    onOpen={() => onOpenPublicationSnapshot(publication)}
                  />
                ))}
            {!showPublicationSkeletons && !publications.length ? (
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
    </div>
  );
}
