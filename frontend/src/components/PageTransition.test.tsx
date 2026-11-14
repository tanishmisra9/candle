import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageTransition } from "./PageTransition";

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}

describe("PageTransition focus management", () => {
  // The first mount is the initial page load; later mounts are client-side navigations.
  it("leaves focus alone on the first load, then moves it to the new <h1> or, failing that, <main>", async () => {
    const first = render(<Shell><h1>Trials</h1></Shell>);
    expect(document.activeElement).toBe(document.body);
    await settle();
    first.unmount();

    const second = render(<Shell><h1>Ask</h1></Shell>);
    expect(document.activeElement).toBe(second.getByRole("heading", { name: "Ask" }));
    second.unmount();

    // A route whose heading is not rendered yet must not leave focus on a removed element.
    const third = render(<Shell><p>Loading</p></Shell>);
    expect(document.activeElement).toBe(third.container.querySelector("main"));
  });

  describe("a page can name its own control to focus (the Ask question box)", () => {
    const pointer = (fine: boolean) =>
      vi.stubGlobal("matchMedia", () => ({ matches: fine, addEventListener() {}, removeEventListener() {} }));
    afterEach(() => vi.unstubAllGlobals());

    const page = (
      <>
        <h1>Ask</h1>
        <input aria-label="Question" data-route-autofocus="" />
      </>
    );

    it("focuses it after a client-side navigation with a mouse-like pointer", async () => {
      pointer(true);
      const first = render(<Shell><h1>Trials</h1></Shell>);
      await settle();
      first.unmount();
      const ask = render(<Shell>{page}</Shell>);
      expect(document.activeElement).toBe(ask.getByLabelText("Question"));
    });

    it("keeps focus on the heading on touch devices (no on-screen keyboard pop)", async () => {
      pointer(false);
      const first = render(<Shell><h1>Trials</h1></Shell>);
      await settle();
      first.unmount();
      const ask = render(<Shell>{page}</Shell>);
      expect(document.activeElement).toBe(ask.getByRole("heading", { name: "Ask" }));
    });
  });
});
