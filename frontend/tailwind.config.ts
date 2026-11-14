import type { Config } from "tailwindcss";

// Colours are RGB channels in CSS variables (see index.css) so opacity modifiers like
// `bg-accent/10` keep working in both themes. Never put a hardcoded rgba()/hex in a component.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter Fallback",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"SF Pro Text\"",
          "\"SF Pro Display\"",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        canvas: token("canvas"),
        panel: token("panel"),
        text: token("text"),
        muted: token("muted"),
        // `line` is decorative hairlines; `line-strong` is for control borders (>= 3:1, WCAG 1.4.11).
        line: token("line"),
        "line-strong": token("line-strong"),
        scrim: token("scrim"),
        success: token("success"),
        danger: token("danger"),
        accent: {
          // Accent as text / indicator colour.
          DEFAULT: token("accent"),
          // Accent as a filled surface; `on` is the text that sits on it.
          fill: token("accent-fill"),
          "fill-hover": token("accent-fill-hover"),
          "fill-pressed": token("accent-fill-pressed"),
          on: token("accent-on"),
        },
      },
      borderRadius: {
        panel: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
