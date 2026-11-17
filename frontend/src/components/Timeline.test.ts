import { describe, expect, it } from "vitest";

import type { TrialSummary } from "../types";
import { barEndYear, pickScrollLeft, statusKey } from "./Timeline";

describe("Timeline statusKey", () => {
  // CT.gov enums: ACTIVE_NOT_RECRUITING / NOT_YET_RECRUITING contain "recruit" but are not
  // recruiting; the marker shape and colour must not claim otherwise.
  it.each([
    ["RECRUITING", "recruiting"],
    ["ENROLLING_BY_INVITATION", "recruiting"],
    ["ACTIVE_NOT_RECRUITING", "active"],
    ["NOT_YET_RECRUITING", "active"],
    ["TERMINATED", "terminated"],
    ["WITHDRAWN", "terminated"],
    ["SUSPENDED", "terminated"],
    [" Recruiting ", "recruiting"],
    ["Active, not recruiting", "active"],
    ["COMPLETED", "other"],
    ["UNKNOWN", "other"],
    [null, "other"],
  ] as const)("%s -> %s", (status, expected) => {
    expect(statusKey(status)).toBe(expected);
  });
});

describe("Timeline barEndYear", () => {
  const trial = (status: string | null, completion_date: string | null) =>
    ({ status, completion_date, start_date: "2012-03-01" }) as TrialSummary;

  it("uses the completion year when there is one", () => {
    expect(barEndYear(trial("COMPLETED", "2016-06-01"), 2012, 2026)).toBe(2016);
    expect(barEndYear(trial("RECRUITING", "2030-01-01"), 2012, 2026)).toBe(2030);
  });

  it("draws a running trial with no end date out to the current year", () => {
    expect(barEndYear(trial("RECRUITING", null), 2012, 2026)).toBe(2026);
    expect(barEndYear(trial("ACTIVE_NOT_RECRUITING", null), 2012, 2026)).toBe(2026);
    expect(barEndYear(trial("NOT_YET_RECRUITING", null), 2031, 2026)).toBe(2031); // never ends before it starts
  });

  it("does not stretch a running trial that has no start date (its start column is a placeholder)", () => {
    const undated = { status: "RECRUITING", completion_date: null, start_date: null } as TrialSummary;
    expect(barEndYear(undated, 2012, 2026)).toBe(2012); // the bars' placeholder start (axis origin)
    expect(barEndYear(undated, 2026, 2026)).toBe(2026); // the axis' placeholder start (current year): same answer, no stretch
  });

  it("leaves finished, stopped and unknown trials as a short bar at their start", () => {
    for (const status of ["COMPLETED", "TERMINATED", "WITHDRAWN", "UNKNOWN", null]) {
      expect(barEndYear(trial(status, null), 2012, 2026), String(status)).toBe(2012);
    }
  });
});

describe("Timeline pickScrollLeft", () => {
  const bar = (x: number, width = 100) => ({ x, width });

  it("does not open on blank grid: it moves to where the bars are (opening at 0 showed a phone nothing)", () => {
    const boxes = [bar(1900), bar(1850), bar(1700), bar(1650), bar(1500)]; // every bar is far to the right
    const left = pickScrollLeft(boxes, 356, 2250, 1800);
    expect(left).toBeGreaterThan(1000);
    expect(boxes.some((b) => b.x < left + 356 && b.x + b.width > left)).toBe(true);
  });

  it("prefers the window that shows the most of the FIRST rows (the first screen), over a busier window further down", () => {
    const first = Array.from({ length: 8 }, (_, i) => bar(1000 + i * 10)); // rows 1-8 all around x=1000
    const later = Array.from({ length: 12 }, (_, i) => bar(100 + i * 10)); // rows 9-20 all around x=100
    const left = pickScrollLeft([...first, ...later], 356, 2250, 100, 0);
    expect(left).toBe(1000);
  });

  it("with equal counts, takes the window centred nearest today", () => {
    const boxes = [bar(100), bar(1500)];
    expect(pickScrollLeft(boxes, 300, 2250, 1550, 0, 8)).toBe(1500);
    expect(pickScrollLeft(boxes, 300, 2250, 120, 0, 8)).toBe(100);
  });

  it("stays at 0 when nothing can scroll, there are no bars, or the width is unknown (jsdom)", () => {
    expect(pickScrollLeft([bar(500)], 800, 700, 0)).toBe(0);
    expect(pickScrollLeft([], 300, 2250, 0)).toBe(0);
    expect(pickScrollLeft([bar(500)], 0, 2250, 0)).toBe(0);
  });

  it("never scrolls past the end of the content", () => {
    expect(pickScrollLeft([bar(2200, 40)], 300, 2250, 2200, 0)).toBe(1950);
  });
});
