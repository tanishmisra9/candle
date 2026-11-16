import { render, screen } from "@testing-library/react";

import type { PublicationSummary } from "../types";
import { PublicationRow } from "./PublicationRow";

function pub(overrides: Partial<PublicationSummary> = {}): PublicationSummary {
  return {
    pmid: "1",
    trial_id: null,
    title: "Gene therapy for choroideremia",
    authors: ["Smith, J", "Lee, K"],
    journal: "Lancet",
    pub_date: "2021-03-01",
    abstract: "Purpose: To test it. Methods: We did. Conclusions: It worked in most participants.",
    doi: null,
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    ...overrides,
  };
}

describe("PublicationRow", () => {
  it("puts journal, year and lead author on one line", () => {
    render(<PublicationRow publication={pub()} onOpen={() => {}} />);
    expect(screen.getByText("Lancet · 2021 · Smith et al.")).toBeInTheDocument();
  });

  it("drops 'et al.' for a single author", () => {
    render(<PublicationRow publication={pub({ authors: ["Smith, J"] })} onOpen={() => {}} />);
    expect(screen.getByText("Lancet · 2021 · Smith")).toBeInTheDocument();
  });

  it("previews the conclusion of a structured abstract, not its Purpose", () => {
    render(<PublicationRow publication={pub()} onOpen={() => {}} />);
    expect(screen.getByText("It worked in most participants.")).toBeInTheDocument();
    expect(screen.queryByText(/To test it/)).not.toBeInTheDocument();
  });

  it("falls back to the opening of an unstructured abstract", () => {
    render(<PublicationRow publication={pub({ abstract: "Plain abstract text." })} onOpen={() => {}} />);
    expect(screen.getByText("Plain abstract text.")).toBeInTheDocument();
  });

  it("labels the linked trial in words", () => {
    render(<PublicationRow publication={pub({ trial_id: "NCT123" })} onOpen={() => {}} />);
    expect(screen.getByText("Trial NCT123")).toBeInTheDocument();
  });
});
