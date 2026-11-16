import { describe, expect, it } from "vitest";

import { mobileMenuMotion, routeTransitionMotion } from "./motion";

describe("mobileMenuMotion", () => {
  it("is completely still under reduced motion (it just appears)", () => {
    const { overlay, list, item } = mobileMenuMotion(true);
    expect(overlay).toEqual({ initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } });
    expect(list.show).toEqual({}); // no stagger
    for (const state of [item.hidden, item.show, item.exit]) expect(state).toEqual({ opacity: 1, y: 0 });
  });

  it.each([false, null])("fades the overlay in, then staggers the links up with a spring (reduced = %s)", (reduced) => {
    const { overlay, list, item } = mobileMenuMotion(reduced);
    expect(overlay.initial.opacity).toBe(0);
    expect(overlay.animate.opacity).toBe(1);
    expect((list.show as { transition: { staggerChildren: number } }).transition.staggerChildren).toBeGreaterThan(0);
    expect(item.hidden).toMatchObject({ opacity: 0, y: 32 });
    expect(item.show.transition.type).toBe("spring");
    // The list must name an exit variant too, or the links never run `item.exit` (the list said "hidden").
    expect(Object.keys(list)).toContain("exit");
    expect(item.exit).toMatchObject({ opacity: 0, y: 16 });
  });
});

// A CSS transform on an ancestor makes it the containing block for `position: fixed` children, so
// during a transformed route transition the Ask composer (and the scroll-to-top button) sat
// against the page wrapper instead of the viewport and then jumped when the transform cleared
// (about 150px on desktop). The route transition must therefore never move or scale the page.
describe("routeTransitionMotion", () => {
  it.each([false, true, null])("has no transform keys (reduced motion = %s)", (reduced) => {
    const variants = routeTransitionMotion(reduced);
    for (const state of [variants.initial, variants.animate, variants.exit]) {
      for (const key of Object.keys(state)) {
        expect(["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "transform", "skewX", "skewY"]).not.toContain(key);
      }
    }
  });

  it("still fades (opacity only) when motion is allowed", () => {
    const variants = routeTransitionMotion(false);
    expect(variants.initial).toEqual({ opacity: 0 });
    expect(variants.animate.opacity).toBe(1);
    expect(variants.exit.opacity).toBe(0);
  });
});
