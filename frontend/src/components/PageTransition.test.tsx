import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
