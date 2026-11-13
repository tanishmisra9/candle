import { useState } from "react";
import { Moon, Sun } from "lucide-react";

import { getTheme, setTheme, type Theme } from "../../lib/theme";
import { Tooltip } from "./Tooltip";

export function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(getTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} theme`;
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Tooltip label={label} describe={false}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          setTheme(next);
          setCurrent(next);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-panel text-text transition-colors hover:bg-text/10"
      >
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
