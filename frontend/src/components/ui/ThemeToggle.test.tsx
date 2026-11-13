import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

// Node's experimental global localStorage shadows jsdom's in this environment; use a plain stub.
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  document.documentElement.classList.remove("dark");
  document.head.innerHTML = '<meta name="theme-color" content="#fbf8ef" />';
});

describe("ThemeToggle", () => {
  it("names the action, flips the theme class, meta colour and persists the choice", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#0b0b0f");
    expect(store.get("candle-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(store.get("candle-theme")).toBe("light");
  });
});
