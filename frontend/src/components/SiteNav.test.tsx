import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import { SiteNav } from "./SiteNav";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function Go() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/ask")}>
      go to ask
    </button>
  );
}

function renderNav(path = "/trials") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteNav />
      <Go />
      <main>page content</main>
      <footer>footer</footer>
    </MemoryRouter>,
  );
}

const trigger = () => screen.getByRole("button", { name: /(open|close) menu/i });
const open = async () => {
  fireEvent.click(trigger());
  return await screen.findByRole("dialog", { name: "Navigation" });
};
const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

afterEach(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});

describe("SiteNav mobile menu", () => {
  it("starts closed, with a menu button that says what it controls", () => {
    renderNav();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveAttribute("aria-controls", "mobile-nav-overlay");
    expect(trigger()).toHaveAccessibleName("Open menu");
  });

  it("opens a full-screen dialog listing the three destinations, marking the current page", async () => {
    renderNav("/literature");
    const dialog = await open();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAccessibleName("Close menu");
    const links = within(dialog).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Trials", "/trials"],
      ["Literature", "/literature"],
      ["Ask", "/ask"],
    ]);
    expect(within(dialog).getByRole("link", { name: "Literature" })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).getByRole("link", { name: "Trials" })).not.toHaveAttribute("aria-current");
  });

  it("locks the page behind it and makes it inert, and puts focus on the first link", async () => {
    renderNav();
    const dialog = await open();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden"); // iOS Safari ignores a lock on <html> alone
    expect(document.querySelector("main")).toHaveAttribute("inert");
    expect(document.querySelector("footer")).toHaveAttribute("inert");
    await waitFor(() => expect(within(dialog).getByRole("link", { name: "Trials" })).toHaveFocus());
  });

  it("Escape closes it, unlocks the page and puts focus back on the button", async () => {
    renderNav();
    await open();
    fireEvent.keyDown(window, { key: "Escape" });
    await closed();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("main")).not.toHaveAttribute("inert");
    expect(document.querySelector("footer")).not.toHaveAttribute("inert");
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("Tab cycles through the menu button and the links, and never leaves them", async () => {
    renderNav();
    const dialog = await open();
    const [first, , last] = within(dialog).getAllByRole("link");
    const tab = (shiftKey = false) => fireEvent.keyDown(window, { key: "Tab", shiftKey });

    last.focus();
    tab();
    expect(trigger()).toHaveFocus(); // the button is the close control: it is part of the cycle
    tab();
    expect(first).toHaveFocus(); // ...and from it Tab goes back into the links
    tab(true);
    expect(trigger()).toHaveFocus();
    tab(true);
    expect(last).toHaveFocus(); // Shift+Tab from the button goes to the last link, NOT out to the theme toggle
  });

  it("Tab from outside the menu (the theme toggle, the page body) pulls focus back in", async () => {
    renderNav();
    const dialog = await open();
    const links = within(dialog).getAllByRole("link");
    screen.getByRole("button", { name: /switch to/i }).focus(); // the header's theme toggle: outside the dialog
    fireEvent.keyDown(window, { key: "Tab" });
    expect(links[0]).toHaveFocus();
    (document.activeElement as HTMLElement).blur(); // focus on <body>, e.g. after a tap on the backdrop
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(links[links.length - 1]).toHaveFocus();
  });

  it("tapping empty space in the menu closes it (the list fills the overlay, so the tap lands on it)", async () => {
    renderNav();
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("list")); // a tap beside or between the links
    await closed();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("the overlay itself can be tapped to close it too", async () => {
    renderNav();
    const dialog = await open();
    fireEvent.click(dialog);
    await closed();
  });

  it("stacks above the Ask composer (z-40) and the scroll-to-top button (z-50) but below the trial dialog (z-60)", async () => {
    renderNav();
    const dialog = await open();
    expect(dialog.className).toContain("z-[55]");
    expect(dialog.className).toContain("touch-none"); // a drag on the menu must not scroll the page behind it
  });

  it("tapping the link of the page you are ON closes it too (the route does not change)", async () => {
    renderNav("/trials");
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("link", { name: "Trials" }));
    await closed();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("a route change (e.g. back/forward) closes it", async () => {
    renderNav("/trials");
    await open();
    // The menu has made `main`/`footer` inert, but the test's own button is outside them.
    act(() => void fireEvent.click(screen.getByRole("button", { name: "go to ask" })));
    await closed();
    expect(document.querySelector("main")).not.toHaveAttribute("inert");
  });

  it("growing the window to desktop width closes it (an invisible overlay must not keep the scroll lock)", async () => {
    let listener: ((event: { matches: boolean }) => void) | null = null;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, callback: (event: { matches: boolean }) => void) => void (listener = callback),
      removeEventListener: () => void (listener = null),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      renderNav();
      await open();
      expect(listener).not.toBeNull();
      act(() => listener!({ matches: true }));
      await closed();
      expect(document.documentElement.style.overflow).toBe("");
      expect(document.querySelector("main")).not.toHaveAttribute("inert");
    } finally {
      window.matchMedia = original;
    }
  });

  it("the open menu has no axe violations", async () => {
    const { container } = renderNav();
    await open();
    expect((await axe(container)).violations).toHaveLength(0);
    expect((await axe(document.body)).violations).toHaveLength(0);
  });
});

describe("SiteNav wordmark", () => {
  it("always shows the product name, on a phone too (it collapsed to an icon below 420px)", () => {
    renderNav();
    const name = screen.getByText("Candle");
    expect(name.className).not.toContain("sr-only");
    expect(name.className).not.toContain("min-[420px]");
  });
});
