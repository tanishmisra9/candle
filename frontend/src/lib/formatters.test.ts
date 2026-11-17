import { describe, expect, it } from "vitest";

import { formatParticipants, normalizeStatus } from "./formatters";

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
