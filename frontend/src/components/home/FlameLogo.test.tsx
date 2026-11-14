import { render } from "@testing-library/react";
import { Flame } from "lucide-react";
import { describe, expect, it } from "vitest";

import { FLAME_PATH, FlameLogo, PauseAnimationButton } from "./FlameLogo";

describe("the logo is the original logo", () => {
  it("draws exactly the lucide Flame path in every layer", () => {
    const original = render(<Flame />).container.querySelector("path")!.getAttribute("d");
    expect(FLAME_PATH).toBe(original);

    const { container } = render(<FlameLogo logoRef={() => {}} />);
    const layers = Object.fromEntries(
      ["fill", "core", "ghost", "trail", "head"].map((name) => [name, container.querySelector(`.flame-${name}`)!]),
    );
    for (const [name, path] of Object.entries(layers)) {
      expect(path.getAttribute("d"), name).toBe(FLAME_PATH);
    }
  });

  it("the outline layers share one dash scale (pathLength 100) so the ember rides the trail", () => {
    const { container } = render(<FlameLogo logoRef={() => {}} />);
    for (const name of ["ghost", "trail", "head"]) {
      expect(container.querySelector(`.flame-${name}`)!.getAttribute("pathLength"), name).toBe("100");
    }
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

describe("PauseAnimationButton", () => {
  it("is hidden when reduced motion is requested (nothing to pause)", () => {
    const { container } = render(<PauseAnimationButton paused={false} reduced onToggle={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has a fixed label and reports its state with aria-pressed", () => {
    const { getByRole, rerender } = render(<PauseAnimationButton paused={false} reduced={false} onToggle={() => {}} />);
    expect(getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "false");
    rerender(<PauseAnimationButton paused reduced={false} onToggle={() => {}} />);
    expect(getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "true");
  });
});
