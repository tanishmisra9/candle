import { describe, expect, it } from "vitest";

import { statusKey } from "./Timeline";

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
    ["COMPLETED", "other"],
    ["UNKNOWN", "other"],
    [null, "other"],
  ] as const)("%s -> %s", (status, expected) => {
    expect(statusKey(status)).toBe(expected);
  });
});
