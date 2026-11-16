import { render, screen } from "@testing-library/react";

import type { TrialSummary } from "../types";
import { TrialCard } from "./TrialCard";

function trial(overrides: Partial<TrialSummary> = {}): TrialSummary {
  return {
    id: "NCT12345678",
    title: "Example CHM Trial",
    status: "RECRUITING",
    phase: "PHASE2",
    start_date: null,
    completion_date: null,
    sponsor: "Biogen",
    intervention: "Gene therapy",
    intervention_type: "GENETIC",
    enrollment: 17,
    primary_endpoint: null,
    locations: [
      { country: "United States" },
      { country: "United States" },
      { country: "United Kingdom" },
      { country: "Germany" },
    ],
    contact_email: null,
    url: "https://clinicaltrials.gov/study/NCT12345678",
    ...overrides,
  };
}

describe("TrialCard", () => {
  it("leads with status, then the title: the status badge comes before the heading in the DOM", () => {
    render(<TrialCard trial={trial()} onOpen={() => {}} />);
    const status = screen.getByText("Recruiting");
    const title = screen.getByRole("heading", { name: "Example CHM Trial" });
    expect(status.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("states sponsor, participants and sites in words, listing the first two distinct countries", () => {
    render(<TrialCard trial={trial()} onOpen={() => {}} />);
    expect(
      screen.getByText("Biogen · 17 participants · 4 sites in United States, United Kingdom +1"),
    ).toBeInTheDocument();
  });

  it("says 'not listed' instead of showing a bare 0 or dash", () => {
    render(<TrialCard trial={trial({ enrollment: null, locations: [], sponsor: null })} onOpen={() => {}} />);
    expect(
      screen.getByText("Unknown sponsor · Participants not listed · Sites not listed"),
    ).toBeInTheDocument();
  });

  it("falls back to the site count when no site names a country", () => {
    render(<TrialCard trial={trial({ locations: [{ city: "Boston" }] })} onOpen={() => {}} />);
    expect(screen.getByText(/· 1 site$/)).toBeInTheDocument();
  });
});
