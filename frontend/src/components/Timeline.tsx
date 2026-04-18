import { motion, useReducedMotion } from "framer-motion";

import type { TrialSummary } from "../types";

function yearFromDate(value: string | null) {
  return value ? Number.parseInt(value.slice(0, 4), 10) : undefined;
}

function colorForStatus(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("recruit")) return "#8AB6A8";
  if (normalized.includes("active")) return "#86A8C8";
  if (normalized.includes("terminat") || normalized.includes("withdraw")) return "#C18A8A";
  return "#B6B2AC";
}

export function Timeline({ trials }: { trials: TrialSummary[] }) {
  const prefersReducedMotion = useReducedMotion();
  const years = trials.flatMap((trial) => [
    yearFromDate(trial.start_date),
    yearFromDate(trial.completion_date),
  ]);
  const filteredYears = years.filter((year): year is number => Number.isFinite(year));
  const startYear = Math.min(...filteredYears, new Date().getFullYear());
  const endYear = Math.max(...filteredYears, startYear + 1);
  const span = Math.max(1, endYear - startYear);
  const rowHeight = 36;
  const width = 980;
  const leftPadding = 300;
  const usableWidth = width - leftPadding - 28;
  const topPadding = 46;

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel px-6 pb-6 pt-8 shadow-panel">
      <motion.svg
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={{ duration: 0.24 }}
        viewBox={`0 0 ${width} ${Math.max(220, trials.length * rowHeight + topPadding + 34)}`}
        className="min-w-[840px]"
        role="img"
        aria-label="Trial timeline"
      >
        {Array.from({ length: span + 1 }, (_, index) => {
          const year = startYear + index;
          const x = leftPadding + (usableWidth * index) / span;
          return (
            <g key={year}>
              <text
                x={x}
                y={18}
                textAnchor="middle"
                className="fill-[var(--muted-text)] text-[11px]"
              >
                {year}
              </text>
              <line
                x1={x}
                x2={x}
                y1={topPadding - 6}
                y2={trials.length * rowHeight + topPadding + 6}
                stroke="var(--hairline)"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {trials.map((trial, index) => {
          const start = yearFromDate(trial.start_date) ?? startYear;
          const end = yearFromDate(trial.completion_date) ?? start;
          const x = leftPadding + ((start - startYear) / span) * usableWidth;
          const barWidth = Math.max(
            10,
            ((Math.max(start, end) - start + 0.35) / span) * usableWidth,
          );
          const y = topPadding + index * rowHeight;
          const label = trial.title.length > 46 ? `${trial.title.slice(0, 46)}…` : trial.title;

          return (
            <motion.g
              key={trial.id}
              initial={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: -10 }
              }
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 1, y: 0 }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      delay: index * 0.025,
                      duration: 0.26,
                      ease: [0.22, 1, 0.36, 1],
                    }
              }
            >
              <text
                x={0}
                y={y + 10}
                className="fill-[var(--text)] text-[12px]"
              >
                {label}
              </text>
              <rect
                x={x}
                y={y - 4}
                width={barWidth}
                height={16}
                rx={8}
                fill={colorForStatus(trial.status)}
                opacity={0.92}
              >
                <title>{`${trial.id}: ${trial.title}`}</title>
              </rect>
            </motion.g>
          );
        })}
      </motion.svg>
    </div>
  );
}
