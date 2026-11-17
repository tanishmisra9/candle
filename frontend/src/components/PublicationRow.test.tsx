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

  it("stops the conclusion at the next section label, so registration and funding lines do not trail it", () => {
    render(
      <PublicationRow
        publication={pub({ abstract: "Purpose: Test. CONCLUSIONS: It worked. TRIAL REGISTRATION: NCT01234567. FUNDING: A grant." })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("It worked.")).toBeInTheDocument();
    expect(screen.queryByText(/REGISTRATION|NCT01234567|grant/)).not.toBeInTheDocument();
  });

  it("does not mistake prose for a Conclusion section ('In conclusion:' mid-abstract)", () => {
    render(
      <PublicationRow
        publication={pub({ abstract: "Background: Rare disease. Methods: Cohort. Results: Mixed. In conclusion: nothing firm yet." })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/^Background: Rare disease\./)).toBeInTheDocument(); // the opening, not the tail from "In conclusion:"
  });

  it("falls back to the opening of an unstructured abstract", () => {
    render(<PublicationRow publication={pub({ abstract: "Plain abstract text." })} onOpen={() => {}} />);
    expect(screen.getByText("Plain abstract text.")).toBeInTheDocument();
  });

  it("gives press feedback at touch-down", () => {
    render(<PublicationRow publication={pub()} onOpen={() => {}} />);
    expect(screen.getByRole("button").className).toMatch(/active:bg-text/);
  });

  it("labels the linked trial in words", () => {
    render(<PublicationRow publication={pub({ trial_id: "NCT123" })} onOpen={() => {}} />);
    expect(screen.getByText("Trial NCT123")).toBeInTheDocument();
  });
});

describe("PublicationRow snippet", () => {
  const show = (abstract: string, query = "") =>
    render(<PublicationRow publication={pub({ abstract })} query={query} onOpen={() => {}} />);
  const snippet = (container: HTMLElement) => container.querySelector("p.line-clamp-3")?.textContent ?? "";

  it("drops a funding sentence that is glued to the conclusion with no label (the real first row)", () => {
    const { container } = show(
      "PURPOSE: x.\n\nCONCLUSIONS: Cone contrast and entropy textural analyses may provide a biomarker for cone health in retinal disease and its response to treatment.Funding for the study provided by NIH R01EY028601, NIH P30EY001583, and Research to Prevent Blindness.",
    );
    expect(snippet(container)).toBe(
      "Cone contrast and entropy textural analyses may provide a biomarker for cone health in retinal disease and its response to treatment.",
    );
  });

  it("leaves genetics notation alone: '(p.Cys182Valfs*14)' is not two glued sentences (it became 'p. Cys182Valfs*14')", () => {
    const { container } = show("CONCLUSIONS: The proband carries c.544delT (p.Cys182Valfs*14) as a hemizygous variant.");
    expect(snippet(container)).toBe("The proband carries c.544delT (p.Cys182Valfs*14) as a hemizygous variant.");
  });

  it("repairs a real glue next to it ('eye.The' after a three-letter word) without touching the notation", () => {
    const { container } = show("CONCLUSIONS: He presented with blurred vision in his left eye.The variant was c.544delT (p.Cys182Valfs*14).");
    expect(snippet(container)).toBe("He presented with blurred vision in his left eye. The variant was c.544delT (p.Cys182Valfs*14).");
  });

  it("keeps a sentence that merely starts with 'Supported by' (only real funding lines are dropped)", () => {
    const { container } = show("CONCLUSIONS: Safe overall. Supported by these data, gene therapy is a promising option.");
    expect(snippet(container)).toBe("Safe overall. Supported by these data, gene therapy is a promising option.");
  });

  it("uses INTERPRETATION when that is what the journal calls it (it opened on a raw 'BACKGROUND:')", () => {
    const { container } = show("BACKGROUND: Rare.\n\nMETHODS: A cohort.\n\nFINDINGS: Gains.\n\nINTERPRETATION: Initial results are consistent with a benefit.");
    expect(snippet(container)).toBe("Initial results are consistent with a benefit.");
  });

  it("opens an abstract with no conclusion without its section label", () => {
    const { container } = show("PURPOSE: To evaluate gene therapy in a cohort.");
    expect(snippet(container)).toBe("To evaluate gene therapy in a cohort.");
  });

  it("cuts at a word, with no half word and no '.…'", () => {
    const sentence = `${"Outcomes varied between the early trials and the later ones ".repeat(3)}across sites.`; // ends near the cut
    const { container } = show(`${sentence} Then it carries on for a good while longer than the limit allows here.`);
    const text = snippet(container);
    expect(text.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/[.,;:]…$/);
    const body = text.slice(0, -1);
    expect(sentence.startsWith(body.slice(0, 40))).toBe(true);
    expect(`${sentence} Then it carries on for a good while longer than the limit allows here.`.charAt(body.length)).toMatch(/[ .]/); // the cut sits on a word end
  });

  it("shows the part of the abstract that matched a search when the term is not in the snippet", () => {
    const abstract = `BACKGROUND: ${"filler words. ".repeat(40)}Zebrafish models show retinal degeneration in the dark. ${"more words. ".repeat(40)}`;
    const { container } = show(abstract, "zebrafish");
    const text = snippet(container);
    expect(text).toMatch(/Zebrafish models show retinal degeneration/);
    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(container.querySelector("mark")?.textContent.toLowerCase()).toBe("zebrafish"); // and it is highlighted
  });

  it("leaves the snippet alone when the term is already in it", () => {
    const { container } = show("CONCLUSIONS: Gene therapy was well tolerated.", "tolerated");
    expect(snippet(container)).toBe("Gene therapy was well tolerated.");
  });
});

describe("PublicationRow title", () => {
  it("shows the title without PubMed's trailing full stop", () => {
    render(<PublicationRow publication={pub({ title: "Gene therapy for choroideremia." })} onOpen={() => {}} />);
    expect(screen.getByText("Gene therapy for choroideremia")).toBeInTheDocument();
  });
});
