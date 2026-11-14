/** Theme switching. The class/`color-scheme`/`theme-color` are first set by the inline script in `index.html` (before paint); this module applies later changes and persists the choice in `localStorage` (guarded: storage can be blocked). */
export type Theme = "light" | "dark";

const STORAGE_KEY = "candle-theme";
// Keep in sync with --canvas in index.css and the pre-paint script in index.html.
const THEME_COLORS: Record<Theme, string> = { light: "#fbf8ef", dark: "#0b0b0f" };

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// Cancels the pending "transitions back on" step of the previous switch, if any.
let cancelRelease: (() => void) | null = null;

/** Run `callback` on the next frame, or on a timer where rAF is unavailable. Returns a canceller. */
function nextFrame(callback: () => void) {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

/**
 * Turn CSS transitions off around a theme flip. The page background changes in one frame, but any
 * `transition-colors` control would otherwise fade over ~140ms, showing old-theme colours on the
 * new background (a visible flash). Transitions come back two frames later, after the restyle has
 * landed; a quick second toggle cancels the first release so it cannot end the window early.
 */
function suppressTransitions(root: HTMLElement) {
  cancelRelease?.();
  root.classList.add("theme-switching");
  let cancelInner: (() => void) | null = null;
  const cancelOuter = nextFrame(() => {
    cancelInner = nextFrame(() => {
      root.classList.remove("theme-switching");
      cancelRelease = null;
    });
  });
  cancelRelease = () => {
    cancelOuter();
    cancelInner?.();
  };
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  suppressTransitions(root);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private windows); the theme still applies for this page view.
  }
}
