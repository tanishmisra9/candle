import { describe, expect, it } from "vitest";

import { normalizeStatus } from "./formatters";

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
