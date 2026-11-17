import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

vi.mock("../lib/mobile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/mobile")>();
  return {
    ...actual,
    NAV_OFFSET_CLASS: "top-[94px]",
  };
});

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
    fireEvent.click(screen.getByRole("menuitem", { name: /Phase 3/i }));

    expect(onToggle).toHaveBeenCalledWith("PHASE3");
    expect(screen.getByRole("menuitem", { name: /Phase 1/i })).toBeInTheDocument();

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

    expect(screen.getByRole("button", { name: "Phase 1" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Phase 1" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Recruiting" }));

    expect(onSelect).toHaveBeenCalledWith("RECRUITING");
  });
});

describe("FilterBar active labels", () => {
  const render1 = (groups: React.ComponentProps<typeof FilterBar>["groups"]) =>
    render(<FilterBar groups={groups} searchValue="" onSearchChange={() => {}} searchPlaceholder="Search" />);

  it("keeps the group name on a picked value ('Status: Recruiting', not just 'Recruiting')", () => {
    render1([
      { label: "Status", value: "RECRUITING", onSelect: () => {}, options: [{ label: "All", value: "" }, { label: "Recruiting", value: "RECRUITING" }] },
      { label: "Sponsor", value: "", onSelect: () => {}, options: [{ label: "All", value: "" }] },
    ]);
    expect(screen.getByRole("button", { name: "Status: Recruiting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sponsor" })).toBeInTheDocument(); // nothing picked: just the group name
  });

  it("does not double the name when the value already starts with it ('Phase 2', not 'Phase: Phase 2')", () => {
    render1([
      { label: "Phase", selectionMode: "multiple", selectedValues: ["PHASE2"], onToggle: () => {}, options: [{ label: "Phase 2", value: "PHASE2" }] },
    ]);
    expect(screen.getByRole("button", { name: "Phase 2" })).toBeInTheDocument();
  });

  it("truncates a long value instead of widening the bar", () => {
    render1([
      {
        label: "Sponsor", value: "X", onSelect: () => {},
        options: [{ label: "Moorfields Eye Hospital NHS Foundation Trust and Partners", value: "X" }],
      },
    ]);
    const button = screen.getByRole("button", { name: /Sponsor: Moorfields/ });
    expect(button.className).toContain("max-w-");
    expect(button.querySelector(".truncate")).not.toBeNull();
  });
});
