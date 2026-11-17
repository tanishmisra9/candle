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

  it("says '1 participant', not '1 participants'", () => {
    render(<TrialCard trial={trial({ enrollment: 1 })} onOpen={() => {}} />);
    expect(screen.getByText(/· 1 participant ·/)).toBeInTheDocument();
  });

  it("gives press feedback at touch-down (a card used to show nothing until the dialog opened)", () => {
    render(<TrialCard trial={trial()} onOpen={() => {}} />);
    expect(screen.getByRole("button").className).toMatch(/active:border-accent/);
  });

  it("lets a title run to three balanced lines, so the word that says what the trial is about is not cut (14 of 29 clipped at two)", () => {
    render(<TrialCard trial={trial()} onOpen={() => {}} />);
    const title = screen.getByRole("heading", { name: "Example CHM Trial" });
    expect(title.className).toContain("line-clamp-3");
    expect(title.className).toContain("text-balance");
  });

  it("falls back to the site count when no site names a country", () => {
    render(<TrialCard trial={trial({ locations: [{ city: "Boston" }] })} onOpen={() => {}} />);
    expect(screen.getByText(/· 1 site$/)).toBeInTheDocument();
  });
});
