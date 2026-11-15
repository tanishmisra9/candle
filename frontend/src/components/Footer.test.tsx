import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "./Footer";

vi.mock("../lib/api", () => ({
  getSyncLastSynced: vi.fn().mockResolvedValue({ last_synced: null }),
}));

function renderFooter(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Footer />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Footer", () => {
  it("links to the guide and the about page, and says Candle gives no medical advice", () => {
    renderFooter("/trials");
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New to CHM? Read the guide" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("link", { name: "About Candle" })).toHaveAttribute("href", "/about");
    expect(screen.getByText("Candle does not give medical advice.")).toBeInTheDocument();
  });

  it("on the landing page keeps the disclaimer but not the two links (the NextSteps band has them)", () => {
    renderFooter("/");
    expect(screen.getByText("Candle does not give medical advice.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing on the Ask page (it has its own sync label under the composer)", () => {
    const { container } = renderFooter("/ask");
    expect(container).toBeEmptyDOMElement();
  });
});
