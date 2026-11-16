/**
 * Lock the page's own scrolling while something modal is open (the trial and publication panels, the mobile
 * menu). Locks <html> AND <body> (iOS Safari keeps scrolling behind an <html>-only lock), and counts holders:
 * a trial panel with a publication panel stacked on top can be closed in either order, and the page must stay
 * locked until the LAST one releases (each one saving and restoring `overflow` on its own unlocked the page
 * as soon as whichever closed first did). Returns the release function; releasing twice is harmless.
 */
let holders = 0;
let saved: { html: string; body: string } | null = null;

export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  if (holders === 0) {
    saved = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
  }
  holders += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0 && saved) {
      html.style.overflow = saved.html;
      body.style.overflow = saved.body;
      saved = null;
    }
  };
}
