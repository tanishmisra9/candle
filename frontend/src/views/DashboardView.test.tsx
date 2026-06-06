import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("DashboardView", () => {
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
        if (params.limit === 1 && params.envelope === "true" && !params.cursor) {
          return { items: [], next_cursor: null, total: 1 };
        }

        return page;
      },
    );

    renderWithQueryClient(<DashboardView onOpenTrialSnapshot={vi.fn()} />);

    expect(await screen.findByText("1 trials tracked")).toBeInTheDocument();
    expect(await screen.findByText("Gene therapy in CHM")).toBeInTheDocument();
  });
});
