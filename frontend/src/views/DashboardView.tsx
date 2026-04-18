import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FilterBar } from "../components/FilterBar";
import { Timeline } from "../components/Timeline";
import { TrialCard } from "../components/TrialCard";
import { TrialCardSkeleton } from "../components/TrialCardSkeleton";
import { listTrials } from "../lib/api";
import {
  formatInterventionTypeLabel,
  formatPhaseLabel,
  formatStatusLabel,
} from "../lib/formatters";
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

function matchesTrialSearch(trial: TrialSummary, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return trial.title.toLowerCase().includes(normalizedSearch);
}

function matchesFacetSelections(
  trial: TrialSummary,
  filters: {
    status: string;
    phase: string;
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
    filters.phase &&
    (trial.phase ?? "").toLowerCase() !== filters.phase.toLowerCase()
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

type DashboardViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
};

export function DashboardView({ onOpenTrialSnapshot }: DashboardViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("");
  const [interventionType, setInterventionType] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const deferredSearch = useDeferredValue(search);

  const filtersQuery = useQuery({
    queryKey: ["trials", "filters"],
    queryFn: () => listTrials({ limit: 500 }),
  });

  const trialsQuery = useQuery({
    queryKey: [
      "trials",
      status,
      phase,
      interventionType,
      sponsor,
      deferredSearch,
      viewMode,
    ],
    queryFn: () =>
      listTrials({
        status: status || undefined,
        phase: phase || undefined,
        intervention_type: interventionType || undefined,
        sponsor: sponsor || undefined,
        q: deferredSearch || undefined,
        limit: 500,
      }),
  });

  const filterSource = filtersQuery.data ?? [];
  const trials = trialsQuery.data ?? [];
  const activeFilters = {
    status,
    phase,
    interventionType,
    sponsor,
    search: deferredSearch,
  };

  const statusOptions = buildFacetOptions(
    filterSource.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "status"),
    ),
    "status",
    status,
    formatStatusLabel,
  );
  const phaseOptions = buildFacetOptions(
    filterSource.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "phase"),
    ),
    "phase",
    phase,
    formatPhaseLabel,
  );
  const interventionTypeOptions = buildFacetOptions(
    filterSource.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "intervention_type"),
    ),
    "intervention_type",
    interventionType,
    formatInterventionTypeLabel,
  );
  const sponsorOptions = buildFacetOptions(
    filterSource.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "sponsor"),
    ),
    "sponsor",
    sponsor,
    (value) => value,
  );
  const hasActiveFilters = Boolean(
    status || phase || interventionType || sponsor || search.trim(),
  );
  const showTrialSkeletons = trialsQuery.isLoading;
  const contentReady = filtersQuery.isFetched && trialsQuery.isFetched;
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
    setPhase("");
    setInterventionType("");
    setSponsor("");
    setSearch("");
  };

  return (
    <div className="space-y-12 pb-20 pt-32">
      <motion.header
        className="space-y-2"
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
          CHM Clinical Trials
        </p>
        <h1 className="text-[38px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {trials.length} trials tracked
        </h1>
      </motion.header>

      <motion.div
        initial={startupReveal?.initial}
        animate={startupReveal?.animate}
        transition={startupReveal?.transition}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
                value: phase,
                onSelect: setPhase,
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
          />

          <div className="sticky top-[94px] z-30 self-start md:pt-4">
            <div className="inline-flex rounded-full border border-line bg-glass p-1 backdrop-blur-2xl">
              <button
                type="button"
                onClick={() =>
                  setViewMode((current) => (current === "timeline" ? "grid" : "timeline"))
                }
                className={`rounded-full px-5 py-2.5 text-[14px] font-medium transition ${
                  viewMode === "timeline"
                    ? "bg-[rgba(232,163,61,0.14)] text-text"
                    : "text-muted"
                }`}
                aria-pressed={viewMode === "timeline"}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>

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
                axisTrials={filterSource}
                onOpen={onOpenTrialSnapshot}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
