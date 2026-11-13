/** Theme switching. The class/`color-scheme`/`theme-color` are first set by the inline script in `index.html` (before paint); this module applies later changes and persists the choice in `localStorage` (guarded: storage can be blocked). */
export type Theme = "light" | "dark";

const STORAGE_KEY = "candle-theme";
// Keep in sync with --canvas in index.css and the pre-paint script in index.html.
const THEME_COLORS: Record<Theme, string> = { light: "#fbf8ef", dark: "#0b0b0f" };

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
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
