import { render, screen } from "@testing-library/react";
import { configureAxe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

vi.mock("../lib/mobile", () => ({
  NAV_OFFSET_CLASS: "top-[94px]",
}));

describe("FilterBar accessibility", () => {
  it("associates the search field with a label and exposes filter menu semantics", async () => {
    const { container } = render(
      <FilterBar
        groups={[
          {
            label: "Status",
            value: "",
            options: [
              { label: "All statuses", value: "" },
              { label: "Recruiting", value: "RECRUITING" },
            ],
            onSelect: () => {},
          },
        ]}
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search trials"
      />,
    );

    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
    expect(screen.getByLabelText("Search trials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("button", { name: "Status" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
