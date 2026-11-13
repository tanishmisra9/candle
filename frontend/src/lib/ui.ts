/** Shared class helpers: underline tabs/toggles (`tabClass`) and link-styled buttons. */
import clsx from "clsx";

// Underline tab / toggle look shared by nav-like controls: 44px target, accent underline when
// active (never colour alone: the text weight and underline both change).
export function tabClass(active: boolean, spacing = "px-4") {
  return clsx(
    "inline-flex min-h-11 items-center border-b-2 text-[14px] font-medium transition-colors",
    spacing,
    active
      ? "border-accent text-text"
      : "border-transparent text-muted hover:border-line-strong hover:text-text",
  );
}

// A link that looks like a button (`ui/Button` is a motion.button, which cannot be an <a>).
// 48px targets; primary uses the accent fill, secondary a strong hairline.
export function linkButtonClass(variant: "primary" | "secondary" = "secondary") {
  return clsx(
    "inline-flex min-h-12 items-center justify-center rounded-panel px-6 text-[1.0625rem] font-medium transition-colors",
    variant === "primary"
      ? "bg-accent-fill text-accent-on hover:bg-accent-fill-hover active:bg-accent-fill-pressed"
      : "border border-line-strong bg-panel text-text hover:bg-text/5",
  );
}
