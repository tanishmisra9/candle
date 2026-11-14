import { describe, expect, it } from "vitest";

import { routeTransitionMotion } from "./motion";

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
