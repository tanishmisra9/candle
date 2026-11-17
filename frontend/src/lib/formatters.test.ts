import { describe, expect, it } from "vitest";

import { formatMonthYear, formatParticipants, normalizeStatus } from "./formatters";

describe("normalizeStatus", () => {
  it.each([
    ["RECRUITING", "RECRUITING"],
    ["Active, not recruiting", "ACTIVE_NOT_RECRUITING"],
    ["  Recruiting ", "RECRUITING"], // stray whitespace must not leave a trailing underscore
    ["not-yet-recruiting", "NOT_YET_RECRUITING"],
    ["", ""],
    [null, ""],
  ] as const)("%j -> %j", (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });
});

describe("formatParticipants", () => {
  it.each([
    [17, "17 participants"],
    [1, "1 participant"], // N-of-1 and first-in-human gene-therapy studies are common here
    [0, "0 participants"],
    [null, "Participants not listed"],
  ])("%s -> %s", (n, expected) => {
    expect(formatParticipants(n)).toBe(expected);
  });
});

describe("formatMonthYear", () => {
  it("runs in a western timezone, so a local-time formatter would be caught", () => {
    expect(new Date("2011-10-01").getDate()).toBe(30); // UTC midnight is the previous evening in Los Angeles
  });

  it.each([
    ["2011-10-01", "Oct 2011"], // a local-time formatter prints "Sep 2011" here
    ["2017-10-01", "Oct 2017"],
    ["2021-01-01", "Jan 2021"], // ... and "Dec 2020" here
    ["2011-10", "Oct 2011"],
    ["2011", "Jan 2011"],
  ])("%s -> %s", (value, expected) => {
    expect(formatMonthYear(value)).toBe(expected);
  });

  it("says Unknown for a missing date and passes through a value it cannot parse", () => {
    expect(formatMonthYear(null)).toBe("Unknown");
    expect(formatMonthYear("not a date")).toBe("not a date");
  });
});
