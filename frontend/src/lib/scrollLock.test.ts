import { afterEach, describe, expect, it } from "vitest";

import { lockPageScroll } from "./scrollLock";

const overflow = () => [document.documentElement.style.overflow, document.body.style.overflow];

afterEach(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});

describe("lockPageScroll", () => {
  it("locks <html> AND <body> and restores what was there before", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "scroll";
    const release = lockPageScroll();
    expect(overflow()).toEqual(["hidden", "hidden"]);
    release();
    expect(overflow()).toEqual(["auto", "scroll"]);
  });

  it("stays locked until the LAST holder releases, whichever order they close in", () => {
    const trial = lockPageScroll();
    const publication = lockPageScroll(); // stacked on top of the trial
    trial(); // the lower one closes first
    expect(overflow()).toEqual(["hidden", "hidden"]); // the publication is still open: still locked
    publication();
    expect(overflow()).toEqual(["", ""]);
  });

  it("releasing the same lock twice does not release someone else's", () => {
    const a = lockPageScroll();
    const b = lockPageScroll();
    a();
    a();
    expect(overflow()).toEqual(["hidden", "hidden"]);
    b();
    expect(overflow()).toEqual(["", ""]);
  });

  it("survives React StrictMode's lock / release / lock", () => {
    const first = lockPageScroll();
    first();
    const second = lockPageScroll();
    expect(overflow()).toEqual(["hidden", "hidden"]);
    second();
    expect(overflow()).toEqual(["", ""]);
  });
});
