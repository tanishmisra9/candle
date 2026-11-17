import { render, screen } from "@testing-library/react";

import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";

function assistant(overrides: Partial<AskMessage> = {}): AskMessage {
  return { id: "a1", role: "assistant", content: "Plain answer.", ...overrides };
}

describe("ChatMessage", () => {
  it("renders a markdown link as a visible link that opens in a new tab (it used to look like body text)", () => {
    render(<ChatMessage message={assistant({ content: "See [ClinicalTrials.gov](https://clinicaltrials.gov) for more." })} />);
    const link = screen.getByRole("link", { name: /ClinicalTrials\.gov/ });
    expect(link).toHaveAttribute("href", "https://clinicaltrials.gov");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(link.className).toContain("underline");
  });

  it("wraps a table so a wide one scrolls inside the bubble instead of widening the page", () => {
    render(<ChatMessage message={assistant({ content: "| Trial | Phase |\n| --- | --- |\n| NCT1 | 2 |" })} />);
    const table = screen.getByRole("table");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    // A keyboard user must be able to focus the scroller to scroll a wide table (axe: scrollable-region-focusable).
    expect(table.parentElement).toHaveAttribute("tabindex", "0");
    expect(table.parentElement).toHaveAttribute("role", "region");
    expect(screen.getByRole("columnheader", { name: "Trial" }).className).toContain("border");
  });

  it("labels the sources and puts Copy on the same row, not in the bubble corner", () => {
    render(
      <ChatMessage
        message={assistant({
          sources: [
            { source_type: "trial", source_id: "NCT1", title: "A trial", url: null },
            { source_type: "publication", source_id: "123", title: "A paper", url: "https://pubmed.ncbi.nlm.nih.gov/123/" },
          ],
        })}
        onOpenTrialSnapshot={() => {}}
      />,
    );
    const label = screen.getByText("Sources (2)");
    const copy = screen.getByRole("button", { name: "Copy response" });
    expect(label.parentElement).toContainElement(copy);
    expect(screen.getByText("PMID 123")).toBeInTheDocument(); // the paper chip says which paper, not just "PubMed"
  });

  it("shows no Sources label when there are none, and no Copy on the user's own message", () => {
    const { rerender } = render(<ChatMessage message={assistant()} />);
    expect(screen.queryByText(/^Sources/)).not.toBeInTheDocument();
    rerender(<ChatMessage message={{ id: "u1", role: "user", content: "Hello" }} />);
    expect(screen.queryByRole("button", { name: "Copy response" })).not.toBeInTheDocument();
  });
});

describe("ChatMessage failure", () => {
  it("marks 'Answer failed' with its own glyph, not the trial card's red 'ended early' square", () => {
    const { container } = render(
      <ChatMessage message={{ id: "e1", role: "assistant", content: "I couldn't complete that answer just now.", isError: true }} />,
    );
    expect(screen.getByText("Answer failed")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".rotate-45")).toBeNull(); // the terminated-tier marker
  });
});

describe("ChatMessage reading width", () => {
  it("caps an answer at 46rem (it ran ~140 characters a line at 1280px) and gives it the full width on a phone", () => {
    const { container } = render(<ChatMessage message={assistant()} />);
    const outer = container.querySelector(".group") as HTMLElement;
    expect(outer.className).toContain("sm:max-w-[min(92%,46rem)]");
    expect(outer.className).toContain("w-full");
    expect(outer.querySelector("div")?.className).toContain("px-4"); // tighter padding on a phone
  });

  it("leaves the reader's own short bubble at 92%", () => {
    const { container } = render(<ChatMessage message={{ id: "u1", role: "user", content: "Hi" }} />);
    expect((container.querySelector(".group") as HTMLElement).className).toContain("max-w-[92%]");
  });
});

describe("ChatMessage source chips", () => {
  const sources = [
    { source_type: "trial" as const, source_id: "NCT03496012", title: "Efficacy and Safety of BIIB111 for the Treatment of Choroideremia", url: null, label: "NCT03496012", detail: "COMPLETED · PHASE3" },
    { source_type: "publication" as const, source_id: "24439297", title: "Retinal gene therapy in patients with choroideremia", url: "https://pubmed.ncbi.nlm.nih.gov/24439297/" },
  ];

  it("shows what each source IS (its title) and which one it is (id, status), not just an ID that needs a hover to explain", () => {
    render(<ChatMessage message={assistant({ sources })} onOpenTrialSnapshot={() => {}} />);
    const trial = screen.getByRole("button", { name: /Efficacy and Safety of BIIB111/ });
    expect(trial).toHaveTextContent("Efficacy and Safety of BIIB111 for the Treatment of Choroideremia");
    expect(trial).toHaveTextContent("NCT03496012 · COMPLETED · PHASE3");
    const paper = screen.getByRole("link", { name: /Retinal gene therapy in patients/ });
    expect(paper).toHaveTextContent("PMID 24439297");
    expect(paper).toHaveAttribute("target", "_blank");
  });

  it("does not repeat the id when the label is the title", () => {
    render(
      <ChatMessage
        message={assistant({ sources: [{ source_type: "publication", source_id: "1", title: "A paper", url: "u", label: "A paper" }] })}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent(/^A paperPMID 1/);
  });
});
