import { render } from "@testing-library/react";
import { Flame } from "lucide-react";
import { describe, expect, it } from "vitest";

import { FLAME_PATH, FlameLogo } from "./FlameLogo";

describe("the logo is the original logo", () => {
  it("draws exactly the lucide Flame path in every layer", () => {
    const original = render(<Flame />).container.querySelector("path")!.getAttribute("d");
    expect(FLAME_PATH).toBe(original);

    const { container } = render(<FlameLogo logoRef={() => {}} />);
    const layers = Object.fromEntries(
      ["fill", "halo", "core", "outline"].map((name) => [name, container.querySelector(`.flame-${name}`)!]),
    );
    for (const [name, path] of Object.entries(layers)) {
      expect(path.getAttribute("d"), name).toBe(FLAME_PATH);
    }
  });

  it("the outline is inside the flickering group with the body and inner flame, so they always move together", () => {
    const { container } = render(<FlameLogo logoRef={() => {}} />);
    const group = container.querySelector(".flame-flicker")!;
    for (const name of ["body", "core", "outline"]) expect(group.querySelector(`.flame-${name}`), name).not.toBeNull();
    // the outline is drawn after (on top of) the body
    const kids = [...group.children].map((c) => c.getAttribute("class"));
    expect(kids.indexOf("flame-body")).toBeLessThan(kids.indexOf("flame-outline"));
  });

  it("the lit fill uses a gradient and the core is the same flame scaled into it", () => {
    const { container } = render(<FlameLogo logoRef={() => {}} />);
    expect(container.querySelector(".flame-fill")!.getAttribute("fill")).toMatch(/^url\(#.+\)$/);
    expect(container.querySelector(".flame-core")!.getAttribute("transform")).toContain("scale(0.5)");
  });

  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<FlameLogo logoRef={() => {}} />);
    expect(container.querySelector(".flame-logo")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("focusable", "false");
  });

  it("forwards the ref to the element whose visibility starts the intro", () => {
    let element: HTMLDivElement | null = null;
    render(<FlameLogo logoRef={(node) => void (element = node)} />);
    expect(element).toHaveClass("flame-logo");
  });
});
