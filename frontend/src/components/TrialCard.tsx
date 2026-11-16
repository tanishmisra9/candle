/** Trial list card. The whole card is one `<button>`, so nothing inside it may be interactive (no tooltips or links on its badges). Title is an `<h2>` under the page `<h1>`. */
import { memo } from "react";

import { highlightText } from "../lib/highlight";
import type { TrialSummary } from "../types";
import { PhasePill } from "./PhasePill";
import { StatusBadge } from "./StatusBadge";

type TrialCardProps = {
  trial: TrialSummary;
  query?: string;
  onOpen: (trialId: string) => void;
};

const MAX_COUNTRIES = 2;

/** "3 sites in United States, United Kingdom" (words, not icons: a bare icon + 0 read as an error). */
function sitesLabel(locations: TrialSummary["locations"]) {
  if (locations.length === 0) return "Sites not listed";
  const count = `${locations.length} site${locations.length === 1 ? "" : "s"}`;
  const countries = Array.from(
    new Set(locations.map((location) => location.country?.trim()).filter((c): c is string => Boolean(c))),
  );
  if (countries.length === 0) return count;
  const shown = countries.slice(0, MAX_COUNTRIES).join(", ");
  const more = countries.length - MAX_COUNTRIES;
  return `${count} in ${shown}${more > 0 ? ` +${more}` : ""}`;
}

export const TrialCard = memo(function TrialCard({ trial, query = "", onOpen }: TrialCardProps) {
  const enrollmentLabel =
    trial.enrollment === null ? "Participants not listed" : `${trial.enrollment} participants`;
  const meta = [trial.sponsor || "Unknown sponsor", enrollmentLabel, sitesLabel(trial.locations)].join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(trial.id)}
      className="group flex h-full flex-col rounded-panel border border-line bg-panel p-7 text-left transition-colors hover:border-accent"
    >
      {/* Status first: "is this open?" is the one fact a visitor scans for, so it leads the card. */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={trial.status} />
        <PhasePill phase={trial.phase} />
      </div>
      <h2 className="mt-5 line-clamp-2 text-[20px] font-medium leading-7 tracking-[-0.015em] text-text">
        {highlightText(trial.title, query)}
      </h2>
      <p className="mt-3.5 line-clamp-2 text-[15px] leading-[1.6] text-muted">
        {trial.intervention || "Intervention details not reported."}
      </p>

      <p className="mt-auto pt-7 text-[13px] leading-[1.5] text-muted tabular-nums">{meta}</p>
    </button>
  );
});
