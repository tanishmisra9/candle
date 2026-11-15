import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AboutView } from "./AboutView";

const renderAbout = () =>
  render(
    <MemoryRouter>
      <AboutView />
    </MemoryRouter>,
  );

describe("AboutView", () => {
  it("has one h1 and the three sections", () => {
    renderAbout();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of ["What Candle does", "What Candle doesn’t do", "A note from the builder"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("has a back arrow to the landing page above the heading (icon only, named for screen readers)", () => {
    renderAbout();
    const back = screen.getByRole("link", { name: "Back to home" });
    expect(back).toHaveAttribute("href", "/");
    expect(back.textContent).toBe(""); // icon-only: the label is the aria-label and the tooltip
    const heading = screen.getByRole("heading", { level: 1 });
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lists short bullets that do not repeat the product name (the headings carry it)", () => {
    renderAbout();
    for (const name of ["What Candle does", "What Candle doesn’t do"]) {
      const section = screen.getByRole("region", { name });
      const bullets = within(section).getAllByRole("listitem");
      expect(bullets.length).toBeGreaterThanOrEqual(3); // split into separate bullets, not one long sentence
      for (const bullet of bullets) {
        expect(bullet.textContent).not.toMatch(/candle/i);
        expect(bullet.textContent!.length).toBeLessThan(95); // short
      }
    }
  });

  it("keeps the limit under 'doesn't do' (no medical advice, which trial, the care team), not under 'does'", () => {
    renderAbout();
    const doesnt = screen.getByRole("region", { name: "What Candle doesn’t do" });
    expect(within(doesnt).getByText(/^Giving medical advice$/)).toBeInTheDocument();
    expect(within(doesnt).getByText(/which trial is right for you/i)).toBeInTheDocument();
    expect(within(doesnt).getByText(/talk with them about decisions/i)).toBeInTheDocument();
    const does = screen.getByRole("region", { name: "What Candle does" });
    expect(within(does).queryByText(/medical advice/i)).not.toBeInTheDocument();
    expect(within(does).getByText(/only what those sources document/i)).toBeInTheDocument();
  });

  it("is honest that AI-written summaries can be wrong", () => {
    renderAbout();
    expect(screen.getByText(/AI-written summaries and overviews can contain mistakes/i)).toBeInTheDocument();
    expect(screen.getByText(/check the original record/i)).toBeInTheDocument();
  });

  it("the builder note uses the same format as every other section (same heading style, no special pull-quote)", () => {
    renderAbout();
    const note = screen.getByRole("heading", { level: 2, name: "A note from the builder" });
    const other = screen.getByRole("heading", { level: 2, name: "What Candle does" });
    expect(note.className).toBe(other.className); // it used to be a small muted label above oversized text
    const body = note.parentElement!.querySelector("p")!;
    expect(body.className).not.toMatch(/text-\[1\.[3-9]/); // not the larger pull-quote size
    expect(body).toHaveTextContent(/I have choroideremia, a rare retinal disease/);
  });

  it("the note is excerpts of the builder's LinkedIn post, without naming the people the post names", () => {
    const { container } = renderAbout();
    const section = screen.getByRole("heading", { level: 2, name: "A note from the builder" }).parentElement!;
    const quote = section.querySelector("blockquote")!;
    expect(quote.querySelectorAll("p").length).toBeGreaterThanOrEqual(3); // paragraphs, not one slab
    // ONE left-aligned column that uses the full width: no width cap (it was 46rem with the right half
    // empty) and no multi-column "dual pane" layout (the owner rejected it).
    expect(quote.className).not.toMatch(/max-w-/);
    expect(quote.className).not.toMatch(/columns-/);
    expect(quote.className).toContain("text-left");
    expect(quote).toHaveTextContent(/built Candle to pull it into one place with plain-language summaries/);
    expect(quote).toHaveTextContent(/three members of the CHM community tested its accessibility/);
    expect(quote).toHaveTextContent(/screen readers they rely on every day/);
    // The post names real people (the foundation's team and the three testers): not repeated here.
    for (const name of ["Kathi", "Wagner", "Macdonald", "McConnell", "Brian", "Counter", "Lin Ogg", "Sheldon", "Lewis"]) {
      expect(container.textContent).not.toContain(name);
    }
  });

  it("presents the release and the post as tiles: no underline and no arrow, like the landing page's choices", () => {
    renderAbout();
    for (const name of [/Read the press release/, /Read the post on LinkedIn/]) {
      const tile = screen.getByRole("link", { name });
      expect(tile.className).not.toMatch(/underline/);
      expect(tile.querySelector("svg")).toBeNull(); // no arrow icon
      expect(tile.className).toContain("hover:ring-accent"); // the outline around the whole tile
    }
  });

  it("no longer carries the CureCHM community link in the note (it moved to the footer)", () => {
    renderAbout();
    expect(screen.queryByRole("link", { name: /CureCHM/ })).not.toBeInTheDocument();
  });

  it("links the LinkedIn post (the clean address, no tracking parameters) and the press release, both in a new tab", () => {
    renderAbout();
    const post = screen.getByRole("link", { name: /Read the post on LinkedIn/ });
    expect(post).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.linkedin\.com\/posts\/.*7470308683810308096/));
    expect(post.getAttribute("href")).not.toMatch(/[?&](utm_|rcm)/);
    // The public release itself: the foundation's press release the post's "full story" link points to.
    const release = screen.getByRole("link", { name: /Read the press release/ });
    expect(release).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.einpresswire\.com\/article\/918493577\//));
    for (const link of [post, release]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
  });
});
