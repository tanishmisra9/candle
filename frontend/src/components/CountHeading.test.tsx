import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountHeading } from "./CountHeading";

const heading = () => screen.getByRole("heading", { level: 1 });

describe("CountHeading", () => {
  it("is mounted but invisible until the number is known (no placeholder word flashes before the count)", () => {
    render(<CountHeading text={null} fallback="Trials" failed={false} />);
    expect(heading()).toHaveAttribute("data-ready", "false");
    expect(heading().style.opacity).toBe("0"); // the real first-paint style, not an animation target
  });

  it("reveals once the number arrives, with the number as its text", () => {
    const { rerender } = render(<CountHeading text={null} fallback="Trials" failed={false} />);
    rerender(<CountHeading text="29 trials tracked" fallback="Trials" failed={false} />);
    expect(heading()).toHaveAttribute("data-ready", "true");
    expect(heading()).toHaveTextContent("29 trials tracked");
  });

  it("does not hide again while a refetch has no number yet (it keeps the last one)", () => {
    const { rerender } = render(<CountHeading text="29 trials tracked" fallback="Trials" failed={false} />);
    rerender(<CountHeading text={null} fallback="Trials" failed={false} />); // a filter changed, the new total is on its way
    expect(heading()).toHaveAttribute("data-ready", "true");
    expect(heading()).toHaveTextContent("29 trials tracked");
  });

  it("shows the plain fallback when the request failed with nothing to show, instead of waiting forever", () => {
    render(<CountHeading text={null} fallback="Literature" failed />);
    expect(heading()).toHaveAttribute("data-ready", "true");
    expect(heading()).toHaveTextContent("Literature");
  });
});
