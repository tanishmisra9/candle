import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { HomeView } from "./HomeView";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

vi.mock("../lib/api", () => ({
  listTrialsPage: vi.fn().mockResolvedValue({ items: [], next_cursor: null, total: 3 }),
  listPublicationsPage: vi.fn().mockResolvedValue({ items: [], next_cursor: null, total: 4 }),
  getSyncLastSynced: vi.fn().mockResolvedValue({ last_synced: null }),
}));

describe("HomeView accessibility", () => {
  it("has no axe violations", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomeView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await axe(container)).violations).toHaveLength(0);
  });
});
