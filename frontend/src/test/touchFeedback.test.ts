import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

describe("touch behaviour of hover styles", () => {
  it("applies hover: only where a pointer can hover (a tap used to leave the card 'hovered' with its accent border)", () => {
    expect(config.future).toMatchObject({ hoverOnlyWhenSupported: true });
  });
});
