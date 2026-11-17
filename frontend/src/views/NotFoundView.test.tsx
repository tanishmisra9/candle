import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import App from "../App";
import { NotFoundView } from "./NotFoundView";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  const empty = { items: [], next_cursor: null, total: 0 };
  return {
    ...actual,
    listTrialsPage: vi.fn().mockResolvedValue(empty),
    listPublicationsPage: vi.fn().mockResolvedValue(empty),
    getSyncLastSynced: vi.fn().mockResolvedValue({ last_synced: null }),
  };
});

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotFoundView", () => {
  it("says the page was not found and offers Trials and Literature, with a way home", () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trials/ })).toHaveAttribute("href", "/trials");
    expect(screen.getByRole("link", { name: /Literature/ })).toHaveAttribute("href", "/literature");
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it.each(["/nope", "/trials/NCT03496012"])("the app renders it for %s (it rendered an empty page)", async (path) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(document.title).toBe("Page not found — Candle");
  });

  it("does not light up the Trials tab on /trials/NCT03496012", async () => {
    renderApp("/trials/NCT03496012");
    await screen.findByRole("heading", { level: 1, name: "Page not found" });
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(primary.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("still renders the real pages", async () => {
    renderApp("/guide");
    expect(await screen.findByRole("heading", { level: 1, name: /guide|CHM/i })).toBeInTheDocument();
    expect(document.title).toBe("Guide — Candle");
  });
});
