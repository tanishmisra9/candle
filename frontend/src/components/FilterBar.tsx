import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "../lib/cn";
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
      className={cn(
        "glass-nav flex w-full flex-col gap-4 rounded-[24px] px-4 py-4 md:w-auto md:flex-row md:items-center md:gap-3",
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
          className="pl-11 pr-14 focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
          {kbdShortcut}
        </span>
      </div>

      <div className={cn("flex flex-wrap items-center gap-2.5", groupsClassName)}>
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
                className={cn(
                  "justify-center px-4 py-2.5 text-[14px]",
                  isActive &&
                    "border-[rgba(232,163,61,0.28)] bg-[rgba(232,163,61,0.08)] text-text",
                  isOpen && !isActive && "border-[rgba(232,163,61,0.28)]",
                )}
              >
                {activeLabel}
              </Button>
              {isOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  aria-labelledby={`${instanceId}-${slugifyLabel(group.label)}-trigger`}
                  className="absolute left-0 top-[calc(100%+10px)] z-20 w-60 rounded-[20px] border border-line bg-panel p-2 shadow-panel backdrop-blur-2xl"
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
                        className={cn(
                          "flex w-full items-center justify-between rounded-[14px] px-3.5 py-2.5 text-left text-[14px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.45)]",
                          isSelected
                            ? "bg-[rgba(232,163,61,0.14)] text-text"
                            : "text-muted hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]",
                          optionIndex === activeOptionIndex && "ring-1 ring-[rgba(232,163,61,0.28)]",
                        )}
                      >
                        <span>{option.label}</span>
                        {isMultiSelect ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded border border-line text-[10px]",
                              isSelected && "border-[rgba(232,163,61,0.9)] bg-[rgba(232,163,61,0.2)]",
                            )}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
            className="rounded-full px-4 py-3 text-[14px] text-muted hover:text-text"
          >
            Clear all filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
