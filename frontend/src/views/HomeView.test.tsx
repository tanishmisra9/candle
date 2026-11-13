import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatPhaseLabel, formatStatusLabel } from "../lib/formatters";
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
  it("has one h1, ordered headings and the three primary actions", () => {
    renderHome();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Candle" })).toBeInTheDocument();
    for (const name of [
      "Where would you like to start?",
      "A short guide to CHM and clinical trials",
      "What Candle does, and what it doesn’t",
      "A note from the builder",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    const actions = ["Browse clinical trials", "Read the research", "Ask a question"];
    for (const name of actions) {
      expect(screen.getAllByRole("link", { name }).length).toBeGreaterThan(0);
    }
    for (const link of screen.getAllByRole("link", { name: "Browse clinical trials" })) {
      expect(link).toHaveAttribute("href", "/trials");
    }
  });

  it("jumps to the in-page guide with a plain anchor (Router links do not scroll to hashes)", () => {
    renderHome();
    const link = screen.getByRole("link", { name: "Read the short guide" });
    expect(link).toHaveAttribute("href", "#how-to-read-a-trial");
    expect(document.getElementById("how-to-read-a-trial")).toBeInTheDocument();
  });

  it("states the live counts as a sentence, pluralised, with the last update", async () => {
    renderHome();
    expect(
      await screen.findByText(/Right now Candle follows 12 clinical trials and 1 publication\./),
    ).toHaveTextContent(/Last updated Nov 12, 2026\./);
  });

  it("shows nothing (never zeros) while loading or when the API is down", async () => {
    api.listTrialsPage.mockRejectedValue(new Error("down"));
    renderHome();
    await waitFor(() => expect(api.listTrialsPage).toHaveBeenCalled());
    expect(screen.queryByText(/Right now Candle follows/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 clinical trials/)).not.toBeInTheDocument();
  });

  it("explains every status and phase using the same labels as the Trials page", () => {
    renderHome();
    const guide = document.getElementById("how-to-read-a-trial")!;
    for (const status of [
      "RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING",
      "COMPLETED", "TERMINATED", "SUSPENDED", "WITHDRAWN",
    ]) {
      expect(within(guide).getByText(formatStatusLabel(status))).toBeInTheDocument();
    }
    for (const phase of ["PHASE1", "PHASE2", "PHASE3", "NA"]) {
      expect(within(guide).getByText(formatPhaseLabel(phase))).toBeInTheDocument();
    }
  });

  it("is honest about limits: no medical advice, AI can be wrong", () => {
    renderHome();
    expect(screen.getByText(/does not give medical advice/i)).toBeInTheDocument();
    expect(screen.getByText(/written by AI\. They can contain mistakes/i)).toBeInTheDocument();
  });

  it("marks external links as opening in a new tab for screen readers", () => {
    renderHome();
    for (const name of [/MedlinePlus Genetics/, /National Eye Institute/, /CureCHM/]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
  });
});
