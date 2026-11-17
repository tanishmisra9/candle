import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardView } from "./DashboardView";
import { listTrialsPage } from "../lib/api";

vi.mock("../lib/api", () => ({
  listTrialsPage: vi.fn(),
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

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardView", () => {
  // The tests count calls on this shared mock: start each from a clean call history.
  beforeEach(() => {
    vi.mocked(listTrialsPage).mockClear();
  });

  it("makes the Timeline toggle full width and centred on a phone, so it lines up with the filter panel above", async () => {
    vi.mocked(listTrialsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={() => {}} />);
    const toggle = await screen.findByRole("button", { name: /timeline view/i });
    expect(toggle.className).toContain("w-full");
    expect(toggle.className).toContain("justify-center");
    expect(toggle.className).toContain("md:w-auto"); // natural width beside the filters on desktop
  });

  it("renders trial cards when the cursor API returns items", async () => {
    const page = {
      items: [
        {
          id: "NCT123",
          title: "Gene therapy in CHM",
          status: "RECRUITING",
          phase: "PHASE2",
          start_date: null,
          completion_date: null,
          sponsor: "Candle",
          intervention: "Subretinal injection",
          intervention_type: "GENETIC",
          enrollment: 12,
          primary_endpoint: null,
          locations: [],
          contact_email: null,
          url: "https://example.com",
        },
      ],
      next_cursor: null,
      total: 1,
    };

    vi.mocked(listTrialsPage).mockImplementation(
      async (params: Record<string, string | number | boolean | string[] | undefined>) => {
        return page;
      },
    );

    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

    expect(await screen.findByText("1 trials tracked")).toBeInTheDocument();
    expect(await screen.findByText("Gene therapy in CHM")).toBeInTheDocument();
  });

  it("keeps every status in the Status menu after one is picked (options come from the unfiltered set)", async () => {
    const make = (id: string, status: string) => ({
      id,
      title: `Trial ${id}`,
      status,
      phase: "PHASE2",
      start_date: null,
      completion_date: null,
      sponsor: "Candle",
      intervention: "x",
      intervention_type: "GENETIC",
      enrollment: 1,
      primary_endpoint: null,
      locations: [],
      contact_email: null,
      url: "https://example.com",
    });
    const all = [make("NCT1", "COMPLETED"), make("NCT2", "RECRUITING")];
    vi.mocked(listTrialsPage).mockImplementation(async (params) => {
      const items = params.status
        ? all.filter((t) => t.status.toLowerCase() === String(params.status).toLowerCase())
        : all;
      return { items, next_cursor: null, total: items.length };
    });

    const user = userEvent.setup();
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Status" }));
    await user.click(await screen.findByRole("menuitem", { name: "Recruiting" }));
    await screen.findByText("Showing 1 of 2 trials");
    await user.click(screen.getByRole("button", { name: "Status: Recruiting" }));

    const menu = screen.getByRole("menu");
    const labels = within(menu).getAllByRole("menuitem").map((item) => item.textContent);
    // Open statuses first, and the other status is still reachable without clearing the filter.
    expect(labels).toEqual(["All", "Recruiting✓", "Completed"]);
  });

  it("says what was searched and offers a way out when nothing matches", async () => {
    vi.mocked(listTrialsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    const user = userEvent.setup();
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

    await user.type(await screen.findByLabelText("Search trial titles"), "zzzz");

    expect(await screen.findByText("No trials match “zzzz”.")).toBeInTheDocument();
    // One way out, in the filter bar: the empty state used to add a second "Clear search and filters" beside it.
    expect(screen.getAllByRole("button", { name: /clear/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByLabelText("Search trial titles")).toHaveValue("");
  });

  it("is not fooled by Home's cached trial count (same data, a limit-1 entry) when it builds the filter menus", async () => {
    const make = (id: string, status: string) => ({
      id, title: `Trial ${id}`, status, phase: "PHASE2", start_date: null, completion_date: null, sponsor: "Candle",
      intervention: "x", intervention_type: "GENETIC", enrollment: 1, primary_endpoint: null, locations: [],
      contact_email: null, url: "https://example.com",
    });
    const all = [make("NCT1", "COMPLETED"), make("NCT2", "RECRUITING")];
    vi.mocked(listTrialsPage).mockImplementation(async () => ({ items: all, next_cursor: null, total: 2 }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // What CandleToday leaves behind after a visit to Home: ONE trial under the "total" key.
    queryClient.setQueryData(["trials", "total"], { items: [all[0]], next_cursor: null, total: 2 });

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardView onOpenTrialSnapshot={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Status" }));
    const labels = within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent);
    expect(labels).toEqual(["All✓", "Recruiting", "Completed"]);
  });

  it("while loading, the heading has no count (it used to claim '0 trials tracked')", async () => {
    vi.mocked(listTrialsPage).mockImplementation(() => new Promise(() => {}));
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Trials" })).toHaveAttribute("data-ready", "false"); // invisible, not a placeholder word
    expect(screen.queryByText(/\b0 trials/)).not.toBeInTheDocument();
  });

  it("reveals the heading with the number once the first page is in", async () => {
    vi.mocked(listTrialsPage).mockResolvedValue({ items: [], next_cursor: null, total: 29 });
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);
    const heading = await screen.findByRole("heading", { level: 1, name: "29 trials tracked" });
    expect(heading).toHaveAttribute("data-ready", "true");
  });

  it("a failed load shows ONE error panel, not '0 trials', an error AND 'No trials are tracked yet'", async () => {
    vi.mocked(listTrialsPage).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

    expect(await screen.findByText(/Trials could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Trials" })).toHaveAttribute("data-ready", "true"); // a failure reveals it
    expect(screen.queryByText(/No trials/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 of|\b0 trials/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);

    vi.mocked(listTrialsPage).mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("data-ready", "true"); // not hidden again mid-retry
    expect(await screen.findByText("0 trials tracked")).toBeInTheDocument(); // a real, loaded zero is still allowed
  });

  it("a later page that fails keeps the rows, says so, and stops asking (the infinite-scroll observer re-fired in a loop)", async () => {
    const trial = (id: string) => ({
      id, title: `Trial ${id}`, status: "COMPLETED", phase: "PHASE2", start_date: null, completion_date: null, sponsor: "Candle",
      intervention: "x", intervention_type: "GENETIC", enrollment: 1, primary_endpoint: null, locations: [], contact_email: null, url: "u",
    });
    // An observer that reports "visible" the moment it is created, as the sentinel is when the list is short.
    const original = window.IntersectionObserver;
    window.IntersectionObserver = class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() { this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
    try {
      vi.mocked(listTrialsPage).mockImplementation(async (params) => {
        if (params.cursor === "c2") {
          await new Promise((resolve) => setTimeout(resolve, 20)); // not instant: real latency is what shows the loop
          throw new Error("boom");
        }
        return { items: [trial("A"), trial("B")], next_cursor: "c2", total: 4 };
      });
      renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

      expect(await screen.findByText(/More trials could not be loaded/)).toBeInTheDocument();
      expect(screen.getByText("Trial A")).toBeInTheDocument(); // the rows already loaded stay
      expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
      const calls = vi.mocked(listTrialsPage).mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(vi.mocked(listTrialsPage).mock.calls.length).toBe(calls);
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
