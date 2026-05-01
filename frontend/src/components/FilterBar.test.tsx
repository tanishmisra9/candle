import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

vi.mock("../lib/mobile", () => ({
  NAV_OFFSET_CLASS: "top-[94px]",
}));

describe("FilterBar multi-select phase group", () => {
  it("shows the count for multiple selected phases and keeps the dropdown open while toggling", () => {
    const onToggle = vi.fn();

    const { rerender } = render(
      <FilterBar
        groups={[
          {
            label: "Phase",
            selectionMode: "multiple",
            selectedValues: ["PHASE1", "PHASE2"],
            onToggle,
            options: [
              { label: "Phase 1", value: "PHASE1" },
              { label: "Phase 2", value: "PHASE2" },
              { label: "Phase 3", value: "PHASE3" },
            ],
          },
        ]}
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search"
      />,
    );

    expect(screen.getByRole("button", { name: "Phase (2)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Phase (2)" }));
    fireEvent.click(screen.getByRole("button", { name: /Phase 3/i }));

    expect(onToggle).toHaveBeenCalledWith("PHASE3");
    expect(screen.getByRole("button", { name: /Phase 1/i })).toBeInTheDocument();

    rerender(
      <FilterBar
        groups={[
          {
            label: "Phase",
            selectionMode: "multiple",
            selectedValues: ["PHASE1"],
            onToggle,
            options: [
              { label: "Phase 1", value: "PHASE1" },
              { label: "Phase 2", value: "PHASE2" },
            ],
          },
        ]}
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search"
      />,
    );

    expect(screen.getAllByRole("button", { name: "Phase 1" })).toHaveLength(2);
  });

  it("leaves single-select groups behaving the same way", () => {
    const onSelect = vi.fn();

    render(
      <FilterBar
        groups={[
          {
            label: "Status",
            value: "",
            onSelect,
            options: [
              { label: "All", value: "" },
              { label: "Recruiting", value: "RECRUITING" },
            ],
          },
        ]}
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(screen.getByRole("button", { name: "Recruiting" }));

    expect(onSelect).toHaveBeenCalledWith("RECRUITING");
  });
});
