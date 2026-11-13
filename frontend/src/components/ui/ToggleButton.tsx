import type { ButtonHTMLAttributes } from "react";

import clsx from "clsx";

type ToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  pressed: boolean;
};

// Two-state filter button. State is carried by aria-pressed, the filled square marker and the
// border, never by colour alone.
export function ToggleButton({ pressed, className, children, ...props }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={clsx(
        "inline-flex min-h-11 items-center gap-2 rounded-panel border px-4 text-[14px] font-medium transition-colors",
        pressed
          ? "border-accent bg-accent/[0.12] text-text"
          : "border-line-strong text-muted hover:text-text",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={clsx("h-3 w-3 border", pressed ? "border-accent bg-accent" : "border-muted")}
      />
      {children}
    </button>
  );
}
