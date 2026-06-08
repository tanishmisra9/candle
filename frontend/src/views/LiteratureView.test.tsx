import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { listPublicationsPage } from "../lib/api";
import { LiteratureView } from "./LiteratureView";

vi.mock("../lib/api", () => ({
  listPublicationsPage: vi.fn(),
}));

function renderWithQueryClient(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("LiteratureView", () => {
  it("auto-fetches all pages and shows total count", async () => {
    vi.mocked(listPublicationsPage).mockImplementation(
      async (params: Record<string, string | number | boolean | string[] | undefined>) => {
        if (params.limit === 1 && params.envelope === "true" && !params.cursor) {
          return { items: [], next_cursor: null, total: 2 };
        }

        if (params.cursor === "cursor-2") {
          return {
            items: [
              {
                pmid: "PMID2",
                trial_id: null,
                title: "Follow-up natural history analysis",
                authors: ["Author B"],
                journal: "Journal B",
                pub_date: "2025-02-01",
                abstract: "Second page abstract",
                doi: null,
                url: "https://example.com/2",
              },
            ],
            next_cursor: null,
            total: 2,
          };
        }

        return {
          items: [
            {
              pmid: "PMID1",
              trial_id: "NCT123",
              title: "Gene therapy publication",
              authors: ["Author A"],
              journal: "Journal A",
              pub_date: "2025-03-01",
              abstract: "First page abstract",
              doi: null,
              url: "https://example.com/1",
            },
          ],
          next_cursor: "cursor-2",
          total: 2,
        };
      },
    );

    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    expect(await screen.findByText("2 publications tracked")).toBeInTheDocument();

    await waitFor(() => {
      expect(listPublicationsPage).toHaveBeenCalledTimes(3);
    });
  });

  it("preserves scroll position when paginating", async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      pmid: `PMID${index}`,
      trial_id: null,
      title: `Publication ${index}`,
      authors: ["Author A"],
      journal: "Journal",
      pub_date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`,
      abstract: "Abstract",
      doi: null,
      url: `https://example.com/${index}`,
    }));

    vi.mocked(listPublicationsPage).mockImplementation(
      async (params: Record<string, string | number | boolean | string[] | undefined>) => {
        if (params.limit === 1 && params.envelope === "true" && !params.cursor) {
          return { items: [], next_cursor: null, total: 60 };
        }
        return { items, next_cursor: null, total: 60 };
      },
    );

    const scrollToSpy = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      writable: true,
      configurable: true,
      value: scrollToSpy,
    });
    Object.defineProperty(window, "scrollY", {
      writable: true,
      configurable: true,
      value: 480,
    });

    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    const nextButton = await screen.findByLabelText("Next page");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 480);
    });
  });
});
