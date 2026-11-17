import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AbstractText } from "./AbstractText";

describe("AbstractText", () => {
  it("keeps the sections of a structured abstract as separate paragraphs with bold labels", () => {
    const { container } = render(
      <AbstractText text={"BACKGROUND: Rare disease.\n\nMETHODS: A cohort.\n\nRESULTS: It worked."} />,
    );
    const paragraphs = [...container.querySelectorAll("p")];
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      "BACKGROUND: Rare disease.",
      "METHODS: A cohort.",
      "RESULTS: It worked.",
    ]);
    expect([...container.querySelectorAll("strong")].map((s) => s.textContent)).toEqual(["BACKGROUND:", "METHODS:", "RESULTS:"]);
  });

  it("recognises the labels real PubMed abstracts use, including multi-word ones", () => {
    const { container } = render(
      <AbstractText text={"MAIN OUTCOME MEASURES: Acuity.\n\nTRANSLATIONAL RELEVANCE: Useful."} />,
    );
    expect([...container.querySelectorAll("strong")].map((s) => s.textContent)).toEqual([
      "MAIN OUTCOME MEASURES:",
      "TRANSLATIONAL RELEVANCE:",
    ]);
  });

  it("leaves an unstructured abstract as one plain paragraph, and does not bold prose or mixed-case labels", () => {
    const { container } = render(
      <AbstractText text="Materials and Methods: a medline search was performed. NOTE: this is prose, not a label." />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("strong")).toHaveLength(0);
  });

  it("keeps a single line break inside a section (a list or sub-heading) instead of collapsing it", () => {
    const { container } = render(<AbstractText text={"RESULTS: Two findings:\n1) first\n2) second"} />);
    const paragraph = container.querySelector("p") as HTMLElement;
    expect(paragraph.className).toContain("whitespace-pre-line");
    expect(paragraph.textContent).toContain("\n1) first\n2) second");
  });
});
