import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  // The tests count calls on this shared mock: start each from a clean call history.
  beforeEach(() => {
    vi.mocked(listPublicationsPage).mockClear();
  });

  it("puts the sort tabs and the Linked toggle on ONE row, tabs left and Linked right (it stacked as three rows)", async () => {
    vi.mocked(listPublicationsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={() => {}} />);
    const sort = await screen.findByRole("group", { name: "Sort order" });
    const linked = screen.getByRole("button", { name: /linked publications/i });
    const row = sort.parentElement!;
    expect(row).toContainElement(linked);
    expect(sort.nextElementSibling).toBe(linked);
    expect(row.className).toContain("justify-between");
    expect(row.className).toContain("md:contents"); // dissolves into the desktop row, which is unchanged
  });

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

  it("brings the top of the list into view and focuses its first row when you change page (the buttons are at the bottom, so keeping the scroll offset landed you at the END of the next page)", async () => {
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

    vi.mocked(listPublicationsPage).mockImplementation(async () => ({
      items,
      next_cursor: null,
      total: 60,
    }));

    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      writable: true,
      configurable: true,
      value: scrollIntoViewSpy,
    });

    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    const next = await screen.findByLabelText("Next page");
    await waitFor(() => expect(document.querySelector("h2")).not.toBeNull()); // rows have swapped in from the skeleton
    fireEvent.click(next);

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: "start" });
    });
    const firstRow = document.querySelector("h2")?.closest("button");
    expect(firstRow).toHaveFocus();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("says what was searched and offers a way out when nothing matches", async () => {
    vi.mocked(listPublicationsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Search title or abstract"), { target: { value: "zzzz" } });

    expect(await screen.findByText("No publications match “zzzz”.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(screen.getByLabelText("Search title or abstract")).toHaveValue("");
  });

  it("names the search that actually ran, not a half-typed one, while the list still shows the previous result", async () => {
    vi.mocked(listPublicationsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);
    const box = await screen.findByLabelText("Search title or abstract");

    fireEvent.change(box, { target: { value: "zzzz" } });
    expect(await screen.findByText("No publications match “zzzz”.")).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "gen" } }); // typing again: the debounced request has not run yet
    expect(screen.getByText("No publications match “zzzz”.")).toBeInTheDocument();
    expect(screen.queryByText(/“gen”/)).not.toBeInTheDocument();
    expect(await screen.findByText("No publications match “gen”.")).toBeInTheDocument(); // once it has run
  });

  it("'Previous' still moves when the list shrank under a stale page (it used to look dead)", async () => {
    const make = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        pmid: `PMID${index}`, trial_id: null, title: `Publication ${index}`, authors: ["Author A"], journal: "Journal",
        pub_date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`, abstract: "Abstract", doi: null, url: `https://example.com/${index}`,
      }));
    vi.mocked(listPublicationsPage).mockResolvedValue({ items: make(120), next_cursor: null, total: 120 });
    Object.defineProperty(Element.prototype, "scrollIntoView", { writable: true, configurable: true, value: vi.fn() });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <LiteratureView onOpenPublicationSnapshot={vi.fn()} />
      </QueryClientProvider>,
    );
    await screen.findByText("Page 1 of 3");
    await waitFor(() => expect(document.querySelector("h2")).not.toBeNull());
    fireEvent.click(screen.getByLabelText("Next page"));
    await screen.findByText("Page 2 of 3");
    fireEvent.click(screen.getByLabelText("Next page"));
    await screen.findByText("Page 3 of 3");

    // The data shrinks to 2 pages while `page` state is 2: page 3 is no longer shown, the clamped page is 2.
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ["publications", "cursor"] })) {
      queryClient.setQueryData(query.queryKey, { pages: [{ items: make(60), next_cursor: null, total: 60 }], pageParams: [null] });
    }
    await screen.findByText("Page 2 of 2");
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("while loading, the heading has no count (it used to claim '0 publications tracked')", async () => {
    vi.mocked(listPublicationsPage).mockImplementation(() => new Promise(() => {}));
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Literature" })).toBeInTheDocument();
    expect(screen.queryByText(/\b0 publications/)).not.toBeInTheDocument();
  });

  it("a failed load shows ONE error panel and no empty-state or zero count", async () => {
    vi.mocked(listPublicationsPage).mockRejectedValue(new Error("boom"));
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    expect(await screen.findByText(/Publications could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Literature" })).toBeInTheDocument();
    expect(screen.queryByText(/No publications/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
  });

  it("a page that fails mid-load keeps the rows already loaded and stops asking (it re-requested in a tight loop)", async () => {
    const item = (pmid: string) => ({
      pmid, trial_id: null, title: `Paper ${pmid}`, authors: ["A"], journal: "J", pub_date: "2025-01-01", abstract: "x", doi: null, url: "u",
    });
    vi.mocked(listPublicationsPage).mockImplementation(async (params) => {
      if (params.cursor === "page-2") {
        // Not instant: with real network latency React renders the "fetching" state between attempts, which is what re-fires
        // the auto-load effect (an instantly-rejecting mock never shows the loop).
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw new Error("boom");
      }
      return { items: [item("1"), item("2")], next_cursor: "page-2", total: 4 };
    });
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);

    expect(await screen.findByText(/Publications could not be loaded/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Paper 1")).toBeInTheDocument()); // the first page stays on screen
    const callsWhenFailed = vi.mocked(listPublicationsPage).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(vi.mocked(listPublicationsPage).mock.calls.length).toBe(callsWhenFailed); // no further requests
  });

  it("keeps the page indicator while the old rows are still shown (it jumped to page 1 on every keystroke)", async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      pmid: `P${index}`, trial_id: null, title: `Publication ${index}`, authors: ["A"], journal: "J",
      pub_date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`, abstract: "x", doi: null, url: "u",
    }));
    vi.mocked(listPublicationsPage).mockResolvedValue({ items, next_cursor: null, total: 60 });
    Object.defineProperty(Element.prototype, "scrollIntoView", { writable: true, configurable: true, value: vi.fn() });
    renderWithQueryClient(<LiteratureView onOpenPublicationSnapshot={vi.fn()} />);
    await screen.findByText("Page 1 of 2");
    await waitFor(() => expect(document.querySelector("h2")).not.toBeNull());
    fireEvent.click(screen.getByLabelText("Next page"));
    await screen.findByText("Page 2 of 2");

    fireEvent.change(screen.getByLabelText("Search title or abstract"), { target: { value: "g" } });
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument(); // the typed letter has not been searched yet
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument(); // once it has, the new results start at page 1
  });
});
