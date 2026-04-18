import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import {
  PublicationRow,
  type PublicationOverviewState,
} from "../components/PublicationRow";
import { cn } from "../lib/cn";
import { listPublications } from "../lib/api";

type LiteratureViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
};

export function LiteratureView({ onOpenTrialSnapshot }: LiteratureViewProps) {
  const pageSize = 50;
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [compactControls, setCompactControls] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null);
  const [overviewCache, setOverviewCache] = useState<Map<string, PublicationOverviewState>>(
    () => new Map(),
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);

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

  useEffect(() => {
    setExpandedPmid(null);
  }, [deferredSearch, linkedOnly, currentPage]);

  const handleOverviewLoad = (pmid: string, state: PublicationOverviewState) => {
    setOverviewCache((current) => {
      const next = new Map(current);
      next.set(pmid, state);
      return next;
    });
  };

  return (
    <div className="space-y-12 pb-20 pt-32">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Publications</p>
        <h1 className="text-[38px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {publications.length} publications tracked
        </h1>
      </header>

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
        className="glass-nav sticky top-[94px] z-30 flex flex-col gap-4 rounded-[24px] px-5 md:flex-row md:items-center md:justify-between"
      >
        <div className="relative grid w-[210px] grid-cols-2 self-start rounded-full border border-line bg-[rgba(255,255,255,0.04)] p-1.5 transition-colors duration-300">
          {[
            { label: "All", value: false },
            { label: "Linked", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setLinkedOnly(option.value)}
              className={cn(
                "relative rounded-full px-5 py-2.5 text-[14px] font-medium transition-colors duration-300",
                linkedOnly === option.value
                  ? "text-text"
                  : "text-muted hover:text-text",
              )}
            >
              {linkedOnly === option.value ? (
                <motion.span
                  layoutId="literature-toggle-pill"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.18 }
                      : { type: "spring", stiffness: 260, damping: 28 }
                  }
                  className="absolute inset-0 rounded-full bg-[rgba(232,163,61,0.14)] shadow-[inset_0_0_0_1px_rgba(232,163,61,0.18)]"
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </button>
          ))}
        </div>

        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: compactControls ? 0.985 : 1,
                }
          }
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="relative w-full md:max-w-[420px]"
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
              isExpanded={expandedPmid === publication.pmid}
              onToggle={() =>
                setExpandedPmid((current) =>
                  current === publication.pmid ? null : publication.pmid,
                )
              }
              overviewCache={overviewCache}
              onOverviewLoad={handleOverviewLoad}
              onOpenTrialSnapshot={onOpenTrialSnapshot}
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
    </div>
  );
}
