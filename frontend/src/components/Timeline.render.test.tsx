import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATUS_TIER_TITLES } from "./StatusBadge";
import { Timeline } from "./Timeline";
import type { TrialSummary } from "../types";

const trial = (id: string, status: string | null): TrialSummary => ({
  id, title: `Trial ${id}`, status, phase: null, start_date: "2015-01-01", completion_date: "2018-01-01", sponsor: null,
  intervention: null, intervention_type: null, enrollment: null, primary_endpoint: null, locations: [], contact_email: null, url: "u",
});

describe("Timeline status vocabulary", () => {
  const trials = [trial("A", "RECRUITING"), trial("B", "COMPLETED"), trial("C", "WITHDRAWN"), trial("D", "UNKNOWN"), trial("E", null)];

  it("has a legend with the SAME four titles as the Guide and the card tiers (it called Completed 'Other / unknown')", () => {
    render(<Timeline trials={trials} onOpen={() => {}} />);
    const legend = screen.getByRole("list", { name: "Trial status legend" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      STATUS_TIER_TITLES.active,
      STATUS_TIER_TITLES.completed,
      STATUS_TIER_TITLES.terminated,
      STATUS_TIER_TITLES.unknown,
    ]);
  });

  it("gives Completed its own marker and colour, not the unknown ones", () => {
    const { container } = render(<Timeline trials={trials} onOpen={() => {}} />);
    const tiers = (id: string) =>
      screen.getByRole("button", { name: new RegExp(`Trial ${id} `) }).querySelector("[data-tier]")?.getAttribute("data-tier");
    expect(tiers("A")).toBe("active");
    expect(tiers("B")).toBe("completed");
    expect(tiers("C")).toBe("terminated");
    expect(tiers("D")).toBe("unknown");
    expect(tiers("E")).toBe("unknown");
    const fills = [...container.querySelectorAll("svg rect[fill*='--tl-']")].map((r) => r.getAttribute("fill"));
    expect(new Set(fills)).toEqual(
      new Set(["rgb(var(--tl-active))", "rgb(var(--tl-completed))", "rgb(var(--tl-terminated))", "rgb(var(--tl-unknown))"]),
    );
  });
});
