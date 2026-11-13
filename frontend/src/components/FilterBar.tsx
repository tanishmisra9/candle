/** Search box plus dropdown filter groups (single or multi select) with menu keyboard navigation (arrows, Home/End, Enter, Escape) and a Ctrl/Cmd+K shortcut. Trigger and option state styling uses `!` modifiers because `Button`'s own border/background tokens would otherwise win the cascade. */
import { Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import clsx from "clsx";
import { dropdownMenuMotion } from "../lib/motion";
import { NAV_OFFSET_CLASS } from "../lib/mobile";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const kbdShortcut = isMac ? "⌘K" : "Ctrl+K";

type FilterOption = { label: string; value: string };

type SingleSelectFilterGroup = {
  selectionMode?: "single";
  label: string;
  value: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
};

type MultiSelectFilterGroup = {
  selectionMode: "multiple";
  label: string;
  selectedValues: string[];
  options: FilterOption[];
  onToggle: (value: string) => void;
};

type FilterGroup = SingleSelectFilterGroup | MultiSelectFilterGroup;

type FilterBarProps = {
  groups: FilterGroup[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onClearAll?: () => void;
  className?: string;
  groupsClassName?: string;
  sticky?: boolean;
};

function slugifyLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function FilterBar({
  groups,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onClearAll,
  className,
  groupsClassName,
  sticky = true,
}: FilterBarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const menuMotion = dropdownMenuMotion(prefersReducedMotion);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchFieldId = useId();
  const instanceId = useId();

  useEffect(() => {
    setActiveOptionIndex(0);
  }, [openGroup]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpenGroup(null);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleMenuKeyDown = (
    event: ReactKeyboardEvent,
    group: FilterGroup,
    menuId: string,
  ) => {
    const options = group.options;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (openGroup !== group.label) {
        setOpenGroup(group.label);
        setActiveOptionIndex(0);
        return;
      }
      setActiveOptionIndex((current) => Math.min(current + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (openGroup !== group.label) {
        setOpenGroup(group.label);
        setActiveOptionIndex(options.length - 1);
        return;
      }
      setActiveOptionIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setOpenGroup(group.label);
      setActiveOptionIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setOpenGroup(group.label);
      setActiveOptionIndex(options.length - 1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpenGroup(null);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (openGroup !== group.label) return;
      event.preventDefault();
      const option = options[activeOptionIndex];
      if (!option) return;
      if (group.selectionMode === "multiple") {
        group.onToggle(option.value);
        return;
      }
      group.onSelect(option.value);
      setOpenGroup(null);
      return;
    }

    if (event.key === "ArrowRight" && openGroup === group.label) {
      const menu = document.getElementById(menuId);
      const items = menu?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[activeOptionIndex]?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={clsx(
        "flex w-full flex-col gap-4 rounded-panel border border-line bg-panel px-4 py-4 md:w-auto md:flex-row md:items-center md:gap-3",
        sticky && ["sticky", NAV_OFFSET_CLASS, "z-30"],
        className,
      )}
    >
      <div className="relative w-full md:w-[390px]">
        <label htmlFor={searchFieldId} className="sr-only">
          {searchPlaceholder}
        </label>
        <Search
          size={17}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={searchFieldId}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-11 md:pr-16"
        />
        <span className="kicker pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-panel border border-line px-2 py-1 text-[11px] text-muted md:block">
          {kbdShortcut}
        </span>
      </div>

      <div className={clsx("flex flex-wrap items-center gap-2.5", groupsClassName)}>
            {groups.map((group) => {
              const isOpen = openGroup === group.label;
              const menuId = `${instanceId}-${slugifyLabel(group.label)}-menu`;
              const isMultiSelect = group.selectionMode === "multiple";
              const activeLabel = isMultiSelect
                ? group.selectedValues.length === 0
                  ? group.label
                  : group.selectedValues.length === 1
                    ? (group.options.find((option) => option.value === group.selectedValues[0])?.label ??
                      group.label)
                    : `${group.label} (${group.selectedValues.length})`
                : group.value
                  ? (group.options.find((option) => option.value === group.value)?.label ??
                    group.label)
                  : group.label;
              const isActive = isMultiSelect ? group.selectedValues.length > 0 : Boolean(group.value);

              return (
                <div key={group.label} className="relative">
                  <Button
                    type="button"
                    variant="secondary"
                    id={`${instanceId}-${slugifyLabel(group.label)}-trigger`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    onKeyDown={(event) => handleMenuKeyDown(event, group, menuId)}
                    className={clsx(
                      "justify-center px-4 py-2.5 text-[14px]",
                      // `!` because Button's own border/bg tokens come later in the generated CSS and would win.
                      isActive && "!border-accent !bg-accent/[0.08]",
                      isOpen && !isActive && "!border-accent",
                    )}
                  >
                    {activeLabel}
                  </Button>
                  <AnimatePresence>
                    {isOpen ? (
                    <motion.div
                      id={menuId}
                      role="menu"
                      aria-labelledby={`${instanceId}-${slugifyLabel(group.label)}-trigger`}
                      initial={menuMotion.initial}
                      animate={menuMotion.animate}
                      exit={menuMotion.exit}
                      className="absolute left-0 top-[calc(100%+8px)] z-50 w-60 max-w-[calc(100vw-2rem)] rounded-panel border border-line-strong bg-panel p-2"
                    >
                      {group.options.map((option, optionIndex) => {
                        const isSelected = isMultiSelect
                          ? group.selectedValues.includes(option.value)
                          : option.value === group.value;

                        return (
                          <button
                            key={option.value || "all"}
                            type="button"
                            role="menuitem"
                            tabIndex={optionIndex === activeOptionIndex ? 0 : -1}
                            aria-checked={isMultiSelect ? isSelected : undefined}
                            onClick={() => {
                              if (isMultiSelect) {
                                group.onToggle(option.value);
                                return;
                              }
                              group.onSelect(option.value);
                              setOpenGroup(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                handleMenuKeyDown(event, group, menuId);
                              }
                            }}
                            className={clsx(
                              "flex min-h-11 w-full items-center justify-between rounded-panel px-3.5 py-2.5 text-left text-[14px] transition-colors",
                              isSelected
                                ? "bg-accent/[0.12] text-text"
                                : "text-muted hover:bg-text/[0.06]",
                              optionIndex === activeOptionIndex &&
                                "ring-2 ring-inset ring-accent",
                            )}
                          >
                            <span>{option.label}</span>
                            {isMultiSelect || isSelected ? (
                              <span
                                aria-hidden="true"
                                className={clsx(
                                  "inline-flex h-4 w-4 items-center justify-center text-[11px]",
                                  isMultiSelect && "rounded-panel border border-line-strong",
                                  isMultiSelect && isSelected && "!border-accent bg-accent/[0.2]",
                                )}
                              >
                                {isSelected ? "✓" : ""}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
            {onClearAll ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpenGroup(null);
                  onClearAll();
                }}
                className="px-4 py-3 text-[14px] text-muted hover:text-text"
              >
                Clear all filters
              </Button>
            ) : null}
      </div>
    </div>
  );
}
