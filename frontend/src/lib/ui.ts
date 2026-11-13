/** Shared class helper for underline tabs/toggles (`tabClass`). */
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
