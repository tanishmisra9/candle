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
