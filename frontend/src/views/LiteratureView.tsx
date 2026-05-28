import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";

import { PublicationRow } from "../components/PublicationRow";
import { PublicationRowSkeleton } from "../components/PublicationRowSkeleton";
import { cn } from "../lib/cn";
import { listPublicationsPage } from "../lib/api";
import { catalogQueryOptions } from "../lib/queryClient";
import { NAV_OFFSET_CLASS, useIsMobile, useScrollVisibilityState } from "../lib/mobile";
import type { PublicationSummary } from "../types";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const kbdShortcut = isMac ? "⌘K" : "Ctrl+K";

type LiteratureViewProps = {
  onOpenPublicationSnapshot: (publication: PublicationSummary) => void;
};

export function LiteratureView({ onOpenPublicationSnapshot }: LiteratureViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchFieldId = useId();
  const isControlsVisible = useScrollVisibilityState({
    enabled: isMobile,
    hideAfter: 140,
    revealWithin: 72,
  });
  const normalizedSearch = search.trim();
  const publicationQueryParams = useMemo(
    () => ({
      envelope: "true" as const,
      limit: 50,
      q: normalizedSearch || undefined,
      linked_only: linkedOnly,
    }),
    [normalizedSearch, linkedOnly],
  );

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

  const publicationsQuery = useInfiniteQuery({
    queryKey: ["publications", "cursor", publicationQueryParams],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listPublicationsPage({
        ...publicationQueryParams,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    ...catalogQueryOptions,
  });

  const publications = publicationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const showPublicationSkeletons = publicationsQuery.isPending;
  const contentReady = publicationsQuery.isSuccess;
  const startupReveal = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 10 },
        animate: contentReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
        transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
      };
  const publicationVirtualizer = useVirtualizer({
    count: publications.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 132,
    overscan: 8,
  });

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
            contentReady && isMobile && !isControlsVisible && "pointer-events-none",
          )}
        >
          <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-3">
            <div className="relative w-full md:w-[420px]">
              <label htmlFor={searchFieldId} className="sr-only">
                Search title or abstract
              </label>
              <Search
                size={17}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id={searchFieldId}
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
                {kbdShortcut}
              </span>
            </div>

            <div className="inline-flex self-start rounded-full border border-line bg-glass p-1 backdrop-blur-2xl md:self-auto">
              <button
                type="button"
                onClick={() => setLinkedOnly((current) => !current)}
                className={cn(
                  "focus-ring rounded-full px-5 py-2.5 text-[14px] font-medium transition",
                  linkedOnly ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
                )}
                aria-pressed={linkedOnly}
                aria-label={
                  linkedOnly
                    ? "Showing linked publications only. Activate to show all publications."
                    : "Activate to show linked publications only."
                }
              >
                Linked
              </button>
            </div>
          </div>
        </div>

        {publicationsQuery.isError ? (
          <div className="rounded-card border border-line bg-panel p-6 text-[15px] text-muted">
            <p>Publications could not be loaded.</p>
            <button
              type="button"
              className="focus-ring mt-4 rounded-full border border-line px-4 py-2 text-[14px] text-text"
              onClick={() => void publicationsQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="rounded-card border border-line bg-panel px-4 shadow-panel md:px-8">
          {showPublicationSkeletons
            ? Array.from({ length: 8 }).map((_, index) => (
                <PublicationRowSkeleton key={`publication-skeleton-${index}`} />
              ))
            : null}

          {!showPublicationSkeletons ? (
            <div ref={listRef} className="max-h-[70vh] overflow-auto">
              <div
                className="relative w-full"
                style={{ height: `${publicationVirtualizer.getTotalSize()}px` }}
              >
                {publicationVirtualizer.getVirtualItems().map((virtualRow) => {
                  const publication = publications[virtualRow.index];
                  if (!publication) {
                    return null;
                  }
                  return (
                    <div
                      key={virtualRow.key}
                      ref={publicationVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <PublicationRow
                        publication={publication}
                        onOpen={onOpenPublicationSnapshot}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!showPublicationSkeletons && !publications.length ? (
            <div className="px-2 py-12 text-[15px] text-muted">
              No publications matched this filter.
            </div>
          ) : null}
        </div>

        {publicationsQuery.hasNextPage ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="focus-ring rounded-full border border-line px-5 py-2.5 text-[14px] text-text"
              disabled={publicationsQuery.isFetchingNextPage}
              onClick={() => void publicationsQuery.fetchNextPage()}
            >
              {publicationsQuery.isFetchingNextPage
                ? "Loading more publications…"
                : "Load more publications"}
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
