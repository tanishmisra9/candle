import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LastSyncedLabel } from "../components/LastSyncedLabel";
import { formatSyncAge } from "./useLastSynced";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("formatSyncAge", () => {
  it.each([
    [0, null],
    [13, null], // fresh enough: the date is plenty
    [14, "2 weeks ago"],
    [30, "4 weeks ago"],
    [62, "8 weeks ago"],
    [63, "2 months ago"],
    [102, "3 months ago"], // the real corpus today (synced Aug 6)
    [344, "11 months ago"],
    [345, "1 year ago"], // never "12 months ago"
    [364, "1 year ago"],
    [365, "1 year ago"],
    [800, "2 years ago"],
  ])("%s days -> %s", (days, expected) => {
    expect(formatSyncAge(daysAgo(days), NOW)).toBe(expected);
  });

  it("is null for a date in the future or one that is not a date", () => {
    expect(formatSyncAge(daysAgo(-3), NOW)).toBeNull();
    expect(formatSyncAge("not a date", NOW)).toBeNull();
  });
});

vi.mock("./useLastSynced", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useLastSynced")>();
  return { ...actual, useLastSynced: () => ({ isPending: false, isError: false, data: { last_synced: state.value } }) };
});
const state = { value: "" };

describe("LastSyncedLabel", () => {
  it("says how old stale data is, in full-contrast text, beside the date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      state.value = daysAgo(102);
      render(<LastSyncedLabel />);
      const age = screen.getByText("3 months ago");
      expect(age.className).toContain("text-text");
      expect(age.parentElement?.textContent).toMatch(/^Data last synced: .* · 3 months ago$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds nothing when the data is fresh", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      state.value = daysAgo(2);
      const { container } = render(<LastSyncedLabel />);
      expect(container.textContent).toMatch(/^Data last synced: [^·]*$/);
    } finally {
      vi.useRealTimers();
    }
  });
});
