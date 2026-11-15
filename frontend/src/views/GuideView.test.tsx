import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { formatPhaseLabel, formatStatusLabel } from "../lib/formatters";
import { GuideView } from "./GuideView";

function renderGuide() {
  return render(
    <MemoryRouter>
      <GuideView />
    </MemoryRouter>,
  );
}

// Written out by hand on purpose: it is the contract the page makes to readers. It must not be
// derived from `statusTier`, or the test could never notice the guide and the badges disagreeing.
const EXPECTED_GROUPS: Record<string, string[]> = {
  "Planned or under way": ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING"],
  Finished: ["COMPLETED"],
  "Ended early or paused": ["TERMINATED", "SUSPENDED", "WITHDRAWN"],
};

describe("GuideView", () => {
  it("has one h1 and links to no in-page anchors", () => {
    const { container } = renderGuide();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
  });

  it("explains every phase using the same labels as the Trials page", () => {
    renderGuide();
    const section = screen.getByRole("region", { name: /phase means/i });
    for (const phase of ["PHASE1", "PHASE2", "PHASE3", "NA"]) {
      expect(within(section).getByText(formatPhaseLabel(phase))).toBeInTheDocument();
    }
  });

  it("puts every status in its group, with the same labels as the Trials page", () => {
    renderGuide();
    const section = screen.getByRole("region", { name: /status means/i });
    for (const [title, statuses] of Object.entries(EXPECTED_GROUPS)) {
      const group = within(section).getByRole("heading", { level: 3, name: title }).parentElement!;
      const shown = within(group).getAllByRole("term").map((term) => term.textContent);
      expect(shown, title).toEqual(statuses.map(formatStatusLabel));
    }
  });

  it("links the sources and marks them as opening in a new tab", () => {
    renderGuide();
    for (const name of [/MedlinePlus Genetics/, /National Eye Institute/]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
  });

  it("leads on to the trials", () => {
    renderGuide();
    expect(screen.getByRole("link", { name: "Browse clinical trials" })).toHaveAttribute("href", "/trials");
  });
});
