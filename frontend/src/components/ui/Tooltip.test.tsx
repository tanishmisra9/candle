import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "./Tooltip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function hover(el: HTMLElement) {
  fireEvent.pointerEnter(el.parentElement as HTMLElement, { pointerType: "mouse" });
}

describe("Tooltip", () => {
  it("opens after a hover delay, links to its trigger and dismisses with Escape", () => {
    render(
      <Tooltip label="Copy response">
        <button type="button">Copy</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Copy" });

    hover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(450));

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Copy response");
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("ignores touch pointers so it never competes with the trigger's own action", () => {
    render(
      <Tooltip label="Send">
        <button type="button">Go</button>
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Go" }).parentElement as HTMLElement, {
      pointerType: "touch",
    });
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("skips aria-describedby when the label repeats the accessible name", () => {
    render(
      <Tooltip label="Close" describe={false}>
        <button type="button" aria-label="Close">
          x
        </button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Close" });
    hover(trigger);
    act(() => void vi.advanceTimersByTime(450));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });
});
