import { render, screen } from "@testing-library/react";
import { configureAxe } from "vitest-axe";

import type { TrialSummary } from "../types";
import { TrialCard } from "./TrialCard";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

function makeTrialSummary(overrides: Partial<TrialSummary> = {}): TrialSummary {
  return {
    id: "NCT12345678",
    title: "Example CHM Trial",
    status: "RECRUITING",
    phase: "PHASE2",
    start_date: null,
    completion_date: null,
    sponsor: "Candle",
    intervention: "Gene therapy",
    intervention_type: "GENETIC",
    enrollment: 128,
    primary_endpoint: "BCVA",
    locations: [
      { city: "Boston", country: "United States", facility: "Mass Eye and Ear" },
      { city: "Chicago", country: "United States", facility: "Northwestern" },
      { city: "London", country: "United Kingdom", facility: "Moorfields" },
    ],
    contact_email: null,
    url: "https://clinicaltrials.gov/study/NCT12345678",
    ...overrides,
  };
}

describe("TrialCard accessibility", () => {
  it("exposes labeled participant and site metadata without violations", async () => {
    const { container } = render(<TrialCard trial={makeTrialSummary()} onOpen={() => {}} />);

    const results = await axe(container);

    expect(results.violations).toHaveLength(0);

    expect(screen.getByText("128")).toHaveAccessibleName(/participants/i);
    expect(screen.getByText("3")).toHaveAccessibleName(/sites/i);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
