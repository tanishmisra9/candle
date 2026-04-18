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

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={
        prefersReducedMotion ? undefined : { y: -2, scale: 1.01, transition: { duration: 0.2 } }
      }
      className="group flex h-full flex-col rounded-card border border-line bg-panel p-6 text-left shadow-panel transition hover:border-[rgba(232,163,61,0.22)]"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={trial.status} />
        <PhasePill phase={trial.phase} />
      </div>

      <h3 className="mt-5 line-clamp-2 text-[17px] font-medium leading-6 tracking-[-0.01em] text-text">
        {trial.title}
      </h3>
      <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-muted">
        {trial.intervention || "Intervention details not reported."}
      </p>

      <div className="mt-auto flex flex-wrap gap-3 pt-6 text-[12px] text-muted tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={14} strokeWidth={1.5} />
          {trial.sponsor || "Unknown sponsor"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} strokeWidth={1.5} />
          {trial.enrollment ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} strokeWidth={1.5} />
          {trial.locations.length}
        </span>
      </div>
    </motion.button>
  );
}
