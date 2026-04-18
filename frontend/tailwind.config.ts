import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"SF Pro Text\"",
          "\"SF Pro Display\"",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        glass: "var(--glass)",
        text: "var(--text)",
        muted: "var(--muted-text)",
        line: "var(--hairline)",
        accent: {
          DEFAULT: "#E8A33D",
          hover: "#F2B861",
          pressed: "#C98524",
        },
      },
      borderRadius: {
        base: "12px",
        card: "16px",
        nav: "24px",
      },
      boxShadow: {
        panel:
          "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
