import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { version } from "../../package.json";
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
  it("shows the release number from package.json, except on Ask", () => {
    const { unmount } = renderFooter("/trials");
    expect(screen.getByText(`Version ${version}`)).toBeInTheDocument();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    unmount();
    renderFooter("/ask");
    expect(screen.queryByText(/^Version /)).toBeNull();
  });

  it("links to the guide and the about page, and says Candle gives no medical advice", () => {
    renderFooter("/trials");
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New to CHM? Read the guide" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("link", { name: "About Candle" })).toHaveAttribute("href", "/about");
    expect(screen.getByText("Candle does not give medical advice.")).toBeInTheDocument();
  });

  it("never links to the page you are already on", () => {
    const names = () => screen.queryAllByRole("link").map((link) => link.textContent);

    const guide = renderFooter("/guide");
    expect(names()).toEqual(["About Candle", "Visit the CureCHM patient community (opens in a new tab)"]); // no second link to /guide on the guide
    guide.unmount();

    const about = renderFooter("/about");
    expect(names()).toEqual(["New to CHM? Read the guide", "Visit the CureCHM patient community (opens in a new tab)"]); // and none to /about on About
    about.unmount();

    renderFooter("/trials");
    expect(names()).toEqual(["New to CHM? Read the guide", "About Candle"]); // elsewhere, both
  });

  it("sees the same page as the router: case and trailing slash do not matter (/Guide, /ABOUT/, /ask/)", () => {
    const guide = renderFooter("/Guide");
    expect(screen.queryByRole("link", { name: /Read the guide/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CureCHM/ })).toBeInTheDocument(); // still an inner page
    guide.unmount();

    const about = renderFooter("/ABOUT/");
    expect(screen.queryByRole("link", { name: "About Candle" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CureCHM/ })).toBeInTheDocument();
    about.unmount();

    // The router renders the Ask page for "/ask/" too, and Ask has no footer (it sits under the composer).
    const { container } = renderFooter("/ask/");
    expect(container).toBeEmptyDOMElement();
  });

  it("treats a trailing slash as the same page", () => {
    renderFooter("/guide/");
    expect(screen.queryByRole("link", { name: /Read the guide/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About Candle" })).toBeInTheDocument();
  });

  it("on the landing page drops the guide and about links (the NextSteps band has them) but keeps the CureCHM one", () => {
    renderFooter("/");
    expect(screen.getByText("Candle does not give medical advice.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Read the guide|About Candle/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /CureCHM/ })).toBeInTheDocument();
  });

  it("carries 'Visit the CureCHM patient community' on the landing page and both inner pages, in a new tab, and nowhere else", () => {
    for (const path of ["/", "/guide", "/about"]) {
      const view = renderFooter(path);
      const link = screen.getByRole("link", { name: /Visit the CureCHM patient community/ });
      expect(link).toHaveAttribute("href", "https://curechm.org");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
      expect(link).toHaveAccessibleName(/opens in a new tab/);
      view.unmount();
    }
    for (const path of ["/trials", "/literature"]) {
      const view = renderFooter(path);
      expect(screen.queryByRole("link", { name: /CureCHM/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("renders nothing on the Ask page (it has its own sync label under the composer)", () => {
    const { container } = renderFooter("/ask");
    expect(container).toBeEmptyDOMElement();
  });
});
