import { motion, useReducedMotion } from "framer-motion";
import { Building2, MapPin, Users } from "lucide-react";

import type { TrialSummary } from "../types";
import { PhasePill } from "./PhasePill";
import { StatusBadge } from "./StatusBadge";

type TrialCardProps = {
  trial: TrialSummary;
  onOpen: () => void;
};

export function TrialCard({ trial, onOpen }: TrialCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const enrollmentLabel =
    trial.enrollment === null ? "Participant count unavailable" : `${trial.enrollment} participants`;
  const locationCount = trial.locations.length;
  const locationLabel = `${locationCount} site${locationCount === 1 ? "" : "s"}`;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -3, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }
      }
      className="group flex h-full flex-col rounded-card border border-line bg-panel p-7 text-left shadow-panel transition-all hover:border-[rgba(232,163,61,0.22)] hover:shadow-panel-hover"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={trial.status} />
        <PhasePill phase={trial.phase} />
      </div>

      <h3 className="mt-6 line-clamp-2 text-[20px] font-medium leading-7 tracking-[-0.015em] text-text">
        {trial.title}
      </h3>
      <p className="mt-3.5 line-clamp-2 text-[15px] leading-[1.6] text-muted">
        {trial.intervention || "Intervention details not reported."}
      </p>

      <div className="mt-auto flex flex-wrap gap-3.5 pt-7 text-[13px] text-muted tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={15} strokeWidth={1.5} />
          {trial.sponsor || "Unknown sponsor"}
        </span>
        <span className="inline-flex items-center gap-1.5" aria-label={enrollmentLabel}>
          <Users size={15} strokeWidth={1.5} aria-hidden="true" />
          {trial.enrollment ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1.5" aria-label={locationLabel}>
          <MapPin size={15} strokeWidth={1.5} aria-hidden="true" />
          {locationCount}
        </span>
      </div>
    </motion.button>
  );
}
