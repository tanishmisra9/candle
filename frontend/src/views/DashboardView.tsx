import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { FilterBar } from "../components/FilterBar";
import { Timeline } from "../components/Timeline";
import { TrialCard } from "../components/TrialCard";
import { listTrials } from "../lib/api";
import {
  formatInterventionTypeLabel,
  formatPhaseLabel,
  formatStatusLabel,
} from "../lib/formatters";
import type { TrialSummary } from "../types";

type ViewMode = "grid" | "timeline";

function uniqueOptions(trials: TrialSummary[], key: keyof TrialSummary) {
  return Array.from(
    new Set(
      trials
        .map((trial) => trial[key])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

type DashboardViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
};

export function DashboardView({ onOpenTrialSnapshot }: DashboardViewProps) {
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

  const statusOptions = uniqueOptions(filterSource, "status");
  const phaseOptions = uniqueOptions(filterSource, "phase");
  const interventionTypeOptions = uniqueOptions(filterSource, "intervention_type");
  const sponsorOptions = uniqueOptions(filterSource, "sponsor");
  const hasActiveFilters = Boolean(
    status || phase || interventionType || sponsor || search.trim(),
  );
  const clearFilters = () => {
    setStatus("");
    setPhase("");
    setInterventionType("");
    setSponsor("");
    setSearch("");
  };

  return (
    <div className="space-y-12 pb-20 pt-32">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
          CHM Clinical Trials
        </p>
        <h1 className="text-[38px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {trials.length} trials tracked
        </h1>
      </header>

      <FilterBar
        groups={[
          {
            label: "Status",
            value: status,
            onSelect: setStatus,
            options: [
              { label: "All", value: "" },
              ...statusOptions.map((option) => ({
                label: formatStatusLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Phase",
            value: phase,
            onSelect: setPhase,
            options: [
              { label: "All", value: "" },
              ...phaseOptions.map((option) => ({
                label: formatPhaseLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Type",
            value: interventionType,
            onSelect: setInterventionType,
            options: [
              { label: "All", value: "" },
              ...interventionTypeOptions.map((option) => ({
                label: formatInterventionTypeLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Sponsor",
            value: sponsor,
            onSelect: setSponsor,
            options: [
              { label: "All", value: "" },
              ...sponsorOptions.map((option) => ({ label: option, value: option })),
            ],
          },
        ]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search trial titles"
        onClearAll={hasActiveFilters ? clearFilters : undefined}
      />

      <div className="flex items-center justify-end pt-4">
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

      <AnimatePresence mode="wait" initial={false}>
        {viewMode === "grid" ? (
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
            <Timeline trials={trials} onOpen={onOpenTrialSnapshot} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
