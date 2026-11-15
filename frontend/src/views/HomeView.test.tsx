import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "./HomeView";

const api = vi.hoisted(() => ({
  listTrialsPage: vi.fn(),
  listPublicationsPage: vi.fn(),
  getSyncLastSynced: vi.fn(),
}));
vi.mock("../lib/api", () => api);

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  api.listTrialsPage.mockResolvedValue({ items: [], next_cursor: null, total: 12 });
  api.listPublicationsPage.mockResolvedValue({ items: [], next_cursor: null, total: 1 });
  api.getSyncLastSynced.mockResolvedValue({ last_synced: "2026-11-12T10:00:00Z" });
});

describe("HomeView", () => {
  it("is one screen: one h1, no other sections, and the three primary actions", () => {
    const { container } = renderHome();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Candle" })).toBeInTheDocument();
    // The guide, the limits and the builder note moved to /guide and /about.
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(container.querySelectorAll("section")).toHaveLength(1);

    const expected = {
      "Browse clinical trials": "/trials",
      "Read the research": "/literature",
      "Ask a question": "/ask",
    };
    for (const [name, href] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("has no in-page hash links", () => {
    const { container } = renderHome();
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
  });

  it("states the live counts as one sentence, pluralised, without the sync date (that is in the footer)", async () => {
    renderHome();
    const sentence = await screen.findByText(/Right now Candle follows 12 clinical trials and 1 publication\./);
    expect(sentence).not.toHaveTextContent(/Last updated/);
  });

  it("shows nothing (never zeros) while loading or when the API is down", async () => {
    api.listTrialsPage.mockRejectedValue(new Error("down"));
    renderHome();
    await waitFor(() => expect(api.listTrialsPage).toHaveBeenCalled());
    expect(screen.queryByText(/Right now Candle follows/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 clinical trials/)).not.toBeInTheDocument();
  });
});
