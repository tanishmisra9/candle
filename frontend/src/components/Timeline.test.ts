import { describe, expect, it } from "vitest";

import type { TrialSummary } from "../types";
import { barEndYear, statusKey } from "./Timeline";

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

  it("leaves finished, stopped and unknown trials as a short bar at their start", () => {
    for (const status of ["COMPLETED", "TERMINATED", "WITHDRAWN", "UNKNOWN", null]) {
      expect(barEndYear(trial(status, null), 2012, 2026), String(status)).toBe(2012);
    }
  });
});
