import { describe, expect, it } from "vitest";

import { markdownToPlainText } from "./plainText";

describe("markdownToPlainText", () => {
  it("drops emphasis, heading, code and link syntax but keeps the words", () => {
    expect(
      markdownToPlainText("## Result\n\nThis is **bold**, *italic*, `code` and [a link](https://x.org)."),
    ).toBe("Result. This is bold, italic, code and a link.");
  });

  it("reads list items as separate sentences without bullet characters", () => {
    expect(markdownToPlainText("Trials:\n\n- NCT00000001 is recruiting\n- NCT00000002 is completed\n1. Third")).toBe(
      "Trials: NCT00000001 is recruiting. NCT00000002 is completed. Third",
    );
  });

  it("removes table pipes and separator rows", () => {
    expect(markdownToPlainText("| Trial | Phase |\n| --- | --- |\n| A | 2 |")).toBe("Trial, Phase. A, 2");
  });

  it("leaves plain prose untouched", () => {
    expect(markdownToPlainText("According to NCT02435940, a trial is recruiting.")).toBe(
      "According to NCT02435940, a trial is recruiting.",
    );
  });
});
