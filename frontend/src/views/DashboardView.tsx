import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FilterBar } from "../components/FilterBar";
import { Timeline } from "../components/Timeline";
import { TrialCard } from "../components/TrialCard";
import { TrialCardSkeleton } from "../components/TrialCardSkeleton";
import { listTrialsPage } from "../lib/api";
import { cn } from "../lib/cn";
import {
  formatInterventionTypeLabel,
  formatPhaseLabel,
  formatStatusLabel,
} from "../lib/formatters";
import { NAV_OFFSET_CLASS, useIsMobile, useScrollVisibilityState } from "../lib/mobile";
import type { TrialSummary } from "../types";

type ViewMode = "grid" | "timeline";
type TrialFacetKey = "status" | "phase" | "intervention_type" | "sponsor";

function uniqueOptions(trials: TrialSummary[], key: keyof TrialSummary) {
  return Array.from(
    new Set(
      trials
        .map((trial) => trial[key])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function matchesTrialSearch(trial: TrialSummary, normalizedSearch: string) {
  if (!normalizedSearch) {
    return true;
  }

  return trial.title.toLowerCase().includes(normalizedSearch);
}

function matchesFacetSelections(
  trial: TrialSummary,
  filters: {
    status: string;
    phases: string[];
    interventionType: string;
    sponsor: string;
    search: string;
  },
  excludedFacet?: TrialFacetKey,
) {
  if (!matchesTrialSearch(trial, filters.search)) {
    return false;
  }

  if (
    excludedFacet !== "status" &&
    filters.status &&
    (trial.status ?? "").toLowerCase() !== filters.status.toLowerCase()
  ) {
    return false;
  }

  if (
    excludedFacet !== "phase" &&
    filters.phases.length > 0 &&
    !filters.phases.some((phase) => phase.toLowerCase() === (trial.phase ?? "").toLowerCase())
  ) {
    return false;
  }

  if (
    excludedFacet !== "intervention_type" &&
    filters.interventionType &&
    (trial.intervention_type ?? "").toLowerCase() !== filters.interventionType.toLowerCase()
  ) {
    return false;
  }

  if (
    excludedFacet !== "sponsor" &&
    filters.sponsor &&
    !(trial.sponsor ?? "").toLowerCase().includes(filters.sponsor.toLowerCase())
  ) {
    return false;
  }

  return true;
}

function buildFacetOptions(
  trials: TrialSummary[],
  key: TrialFacetKey,
  selectedValue: string,
  labelForValue: (value: string) => string,
) {
  const values = uniqueOptions(trials, key);
  const normalizedSelectedValue = selectedValue.toLowerCase();
  const selectedMissing =
    selectedValue &&
    !values.some((value) => value.toLowerCase() === normalizedSelectedValue);
  const orderedValues = selectedMissing ? [selectedValue, ...values] : values;

  return [
    { label: "All", value: "" },
    ...orderedValues.map((value) => ({
      label: labelForValue(value),
      value,
    })),
  ];
}

function buildMultiSelectFacetOptions(
  trials: TrialSummary[],
  key: TrialFacetKey,
  selectedValues: string[],
  labelForValue: (value: string) => string,
) {
  const values = uniqueOptions(trials, key);
  const seen = new Set(values.map((value) => value.toLowerCase()));
  const orderedValues = [...selectedValues, ...values].filter((value) => {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      seen.delete(normalized);
      return true;
    }
    return !values.some((existing) => existing.toLowerCase() === normalized);
  });

  return orderedValues.map((value) => ({
    label: labelForValue(value),
    value,
  }));
}

type DashboardViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
};

export function DashboardView({ onOpenTrialSnapshot }: DashboardViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState<string[]>([]);
  const [interventionType, setInterventionType] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const isControlsVisible = useScrollVisibilityState({
    enabled: isMobile,
    hideAfter: 140,
    revealWithin: 72,
  });
  const normalizedSearch = search.trim().toLowerCase();

  const trialsQuery = useInfiniteQuery({
    queryKey: ["trials", "cursor"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listTrialsPage({
        envelope: "true",
        limit: 200,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  useEffect(() => {
    if (trialsQuery.hasNextPage && !trialsQuery.isFetchingNextPage) {
      void trialsQuery.fetchNextPage();
    }
  }, [trialsQuery.fetchNextPage, trialsQuery.hasNextPage, trialsQuery.isFetchingNextPage]);

  const allTrials = trialsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeFilters = {
    status,
    phases: phase,
    interventionType,
    sponsor,
    search: normalizedSearch,
  };
  const trials = allTrials.filter((trial) => matchesFacetSelections(trial, activeFilters));

  const statusOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "status"),
    ),
    "status",
    status,
    formatStatusLabel,
  );
  const phaseOptions = buildMultiSelectFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "phase"),
    ),
    "phase",
    phase,
    formatPhaseLabel,
  );
  const interventionTypeOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "intervention_type"),
    ),
    "intervention_type",
    interventionType,
    formatInterventionTypeLabel,
  );
  const sponsorOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "sponsor"),
    ),
    "sponsor",
    sponsor,
    (value) => value,
  );
  const hasActiveFilters = Boolean(
    status || phase.length || interventionType || sponsor || search.trim(),
  );
  const showTrialSkeletons =
    trialsQuery.isPending || trialsQuery.isFetchingNextPage || Boolean(trialsQuery.hasNextPage);
  const contentReady =
    trialsQuery.isFetched && !trialsQuery.isFetchingNextPage && !trialsQuery.hasNextPage;
  const startupReveal = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, filter: "blur(14px)" },
        animate: contentReady
          ? { opacity: 1, filter: "blur(0px)" }
          : { opacity: 0, filter: "blur(14px)" },
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
      };
  const clearFilters = () => {
    setStatus("");
    setPhase([]);
    setInterventionType("");
    setSponsor("");
    setSearch("");
  };
  const togglePhase = (phaseValue: string) => {
    setPhase((current) =>
      current.some((value) => value.toLowerCase() === phaseValue.toLowerCase())
        ? current.filter((value) => value.toLowerCase() !== phaseValue.toLowerCase())
        : [...current, phaseValue],
    );
  };
  const stickyTrayAnimate = prefersReducedMotion
    ? undefined
    : {
        y: isControlsVisible ? 0 : -18,
        opacity: isControlsVisible ? 1 : 0,
        scale: isControlsVisible ? 1 : 0.985,
        filter: isControlsVisible ? "blur(0px)" : "blur(8px)",
      };

  const filterBar = (
    <FilterBar
      groups={[
        {
          label: "Status",
          value: status,
          onSelect: setStatus,
          options: statusOptions,
        },
        {
          label: "Phase",
          selectionMode: "multiple",
          selectedValues: phase,
          onToggle: togglePhase,
          options: phaseOptions,
        },
        {
          label: "Type",
          value: interventionType,
          onSelect: setInterventionType,
          options: interventionTypeOptions,
        },
        {
          label: "Sponsor",
          value: sponsor,
          onSelect: setSponsor,
          options: sponsorOptions,
        },
      ]}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search trial titles"
      onClearAll={hasActiveFilters ? clearFilters : undefined}
      sticky={!isMobile}
      className={
        isMobile
          ? "border-0 bg-transparent px-0 py-0 shadow-none backdrop-blur-none"
          : undefined
      }
    />
  );

  const timelineToggle = (
    <div className="inline-flex rounded-full border border-line bg-glass p-1 backdrop-blur-2xl">
      <button
        type="button"
        onClick={() =>
          setViewMode((current) => (current === "timeline" ? "grid" : "timeline"))
        }
        className={cn(
          "rounded-full px-5 py-2.5 text-[14px] font-medium transition",
          viewMode === "timeline" ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
        )}
        aria-pressed={viewMode === "timeline"}
      >
        Timeline
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 pt-28 md:space-y-12 md:pt-32">
      <motion.header
        className="space-y-2"
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
          CHM Clinical Trials
        </p>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {trials.length} trials tracked
        </h1>
      </motion.header>

      <motion.div
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
        className="space-y-4"
      >
        {isMobile ? (
          <motion.div
            animate={stickyTrayAnimate}
            transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.85 }}
            className={cn(
              "glass-nav sticky z-30 space-y-3 rounded-[24px] px-4 py-4",
              NAV_OFFSET_CLASS,
              !isControlsVisible && "pointer-events-none",
            )}
          >
            {filterBar}
            <div className="flex items-center justify-start">{timelineToggle}</div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            {filterBar}

            <div className={cn("sticky z-30 self-start md:pt-4", NAV_OFFSET_CLASS)}>
              {timelineToggle}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {showTrialSkeletons ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24 }}
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <TrialCardSkeleton key={`trial-skeleton-${index}`} />
              ))}
            </motion.div>
          ) : viewMode === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24 }}
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              {trials.map((trial) => (
                <TrialCard
                  key={trial.id}
                  trial={trial}
                  onOpen={() => onOpenTrialSnapshot(trial.id)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24 }}
              className="pt-4"
            >
              <Timeline
                trials={trials}
                axisTrials={allTrials}
                onOpen={onOpenTrialSnapshot}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
