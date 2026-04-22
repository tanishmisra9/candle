import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { useIsMobile } from "../lib/mobile";
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

type TimelineProps = {
  trials: TrialSummary[];
  axisTrials?: TrialSummary[];
  onOpen: (trialId: string) => void;
};

export function Timeline({ trials, axisTrials, onOpen }: TimelineProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentYear = new Date().getFullYear();
  const timelineAxisSource = axisTrials?.length ? axisTrials : trials;
  const years = timelineAxisSource.flatMap((trial) => [
    yearFromDate(trial.start_date),
    yearFromDate(trial.completion_date),
  ]);
  const filteredYears = years.filter((year): year is number => Number.isFinite(year));
  const startYear = Math.min(...filteredYears, new Date().getFullYear());
  const endYear = Math.max(...filteredYears, startYear + 1);
  const span = Math.max(1, endYear - startYear);
  const rowHeight = isMobile ? 52 : 44;
  const leftPadding = isMobile ? 20 : 352;
  const labelColumnWidth = 316;
  const yearSpacing = isMobile ? 66 : 52;
  const width = isMobile
    ? Math.max(560, leftPadding + span * yearSpacing + 152)
    : Math.max(1120, leftPadding + span * yearSpacing + 120);
  const usableWidth = isMobile ? width - leftPadding - 120 : width - leftPadding - 28;
  const topPadding = isMobile ? 50 : 56;
  const chartHeight = Math.max(
    isMobile ? 240 : 280,
    trials.length * rowHeight + topPadding + 42,
  );

  useEffect(() => {
    if (!scrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollLeft = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [width, chartHeight]);

  if (isMobile) {
    return (
      <div className="rounded-card border border-line bg-panel shadow-panel">
        <div ref={scrollRef} className="overflow-x-auto px-4 pb-5 pt-5">
          <div
            className="relative"
            style={{ minWidth: `${width}px`, width: `${width}px`, height: `${chartHeight}px` }}
          >
            <motion.svg
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1 }}
              transition={{ duration: 0.24 }}
              viewBox={`0 0 ${width} ${chartHeight}`}
              className="absolute inset-0 block"
              style={{ width: `${width}px`, height: `${chartHeight}px` }}
              role="img"
              aria-label="Trial timeline"
            >
              {Array.from({ length: span + 1 }, (_, index) => {
                const year = startYear + index;
                const x = leftPadding + (usableWidth * index) / span;
                const isCurrentYear = year === currentYear;

                return (
                  <g key={year}>
                    {isCurrentYear ? (
                      <rect
                        x={x - 18}
                        y={4}
                        width={36}
                        height={22}
                        rx={10}
                        fill="rgba(232, 163, 61, 0.14)"
                        stroke="rgba(232, 163, 61, 0.24)"
                      />
                    ) : null}
                    <text
                      x={x}
                      y={19}
                      textAnchor="middle"
                      className={
                        isCurrentYear
                          ? "fill-[#F5E0B6] text-[12px]"
                          : "fill-[var(--muted-text)] text-[12px]"
                      }
                    >
                      {year}
                    </text>
                    <line
                      x1={x}
                      x2={x}
                      y1={topPadding - 6}
                      y2={chartHeight - 14}
                      stroke={
                        isCurrentYear ? "rgba(232, 163, 61, 0.18)" : "var(--hairline)"
                      }
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
              {trials.map((_, index) => {
                const y = topPadding + index * rowHeight + 17;
                return (
                  <line
                    key={`mobile-row-${index}`}
                    x1={leftPadding}
                    x2={width - 16}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="1"
                  />
                );
              })}
            </motion.svg>

            {trials.map((trial, index) => {
              const start = yearFromDate(trial.start_date) ?? startYear;
              const end = yearFromDate(trial.completion_date) ?? start;
              const x = leftPadding + ((start - startYear) / span) * usableWidth;
              const barWidth = Math.max(
                104,
                ((Math.max(start, end) - start + 0.45) / span) * usableWidth,
              );
              const y = topPadding + index * rowHeight;
              const label =
                trial.title.length > 44 ? `${trial.title.slice(0, 44)}…` : trial.title;

              return (
                <motion.button
                  key={trial.id}
                  type="button"
                  onClick={() => onOpen(trial.id)}
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          delay: index * 0.025,
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                  className="absolute flex h-[30px] items-center overflow-hidden rounded-full px-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]"
                  style={{
                    left: `${x}px`,
                    top: `${y - 6}px`,
                    width: `${barWidth}px`,
                    backgroundColor: colorForStatus(trial.status),
                    opacity: 0.96,
                  }}
                  aria-label={`${trial.title} (${trial.id})`}
                  title={trial.title}
                >
                  <span className="block w-full truncate text-[12px] font-medium text-[rgba(11,11,15,0.86)]">
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-panel shadow-panel">
      <div className="grid overflow-hidden" style={{ gridTemplateColumns: `${labelColumnWidth}px minmax(0,1fr)` }}>
        <div className="border-r border-line px-5 pb-7 pt-9">
          <div
            className="space-y-0"
            style={{ height: `${chartHeight}px`, paddingTop: `${topPadding - 8}px` }}
          >
            {trials.map((trial, index) => {
              const label =
                trial.title.length > 42 ? `${trial.title.slice(0, 42)}…` : trial.title;

              return (
                <button
                  key={trial.id}
                  type="button"
                  onClick={() => onOpen(trial.id)}
                  className="flex h-[44px] w-full items-center rounded-[12px] px-3 text-left text-[13px] text-text transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F5E0B6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]"
                  title={trial.title}
                >
                  <span className="block truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-x-auto px-7 pb-7 pt-9">
          <motion.svg
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.24 }}
            viewBox={`0 0 ${width} ${chartHeight}`}
            className="block"
            style={{ minWidth: `${width}px`, width: `${width}px` }}
            role="img"
            aria-label="Trial timeline"
          >
            {Array.from({ length: span + 1 }, (_, index) => {
              const year = startYear + index;
              const x = leftPadding + (usableWidth * index) / span;
              const isCurrentYear = year === currentYear;
              return (
                <g key={year}>
                  {isCurrentYear ? (
                    <rect
                      x={x - 18}
                      y={2}
                      width={36}
                      height={22}
                      rx={10}
                      fill="rgba(232, 163, 61, 0.14)"
                      stroke="rgba(232, 163, 61, 0.24)"
                    />
                  ) : null}
                  <text
                    x={x}
                    y={18}
                    textAnchor="middle"
                    className={
                      isCurrentYear
                        ? "fill-[#F5E0B6] text-[12px]"
                        : "fill-[var(--muted-text)] text-[12px]"
                    }
                  >
                    {year}
                  </text>
                  <line
                    x1={x}
                    x2={x}
                    y1={topPadding - 6}
                    y2={trials.length * rowHeight + topPadding + 6}
                    stroke={
                      isCurrentYear
                        ? "rgba(232, 163, 61, 0.18)"
                        : "var(--hairline)"
                    }
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
                  <rect
                    x={x}
                    y={y - 5}
                    width={barWidth}
                    height={18}
                    rx={9}
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
      </div>
    </div>
  );
}
