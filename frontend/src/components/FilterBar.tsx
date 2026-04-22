import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { NAV_OFFSET_CLASS } from "../lib/mobile";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

type FilterGroup = {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
};

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
        <Search
          size={17}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          ref={inputRef}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-11 pr-14"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
          ⌘K
        </span>
      </div>

      <div className={cn("flex flex-wrap items-center gap-2.5", groupsClassName)}>
        {groups.map((group) => {
          const isOpen = openGroup === group.label;
          const activeLabel =
            group.options.find((option) => option.value === group.value)?.label ?? group.label;

          return (
            <div key={group.label} className="relative">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                className={cn(
                  "justify-center px-4 py-2.5 text-[14px]",
                  group.value &&
                    "border-[rgba(232,163,61,0.28)] bg-[rgba(232,163,61,0.08)] text-text",
                  isOpen && !group.value && "border-[rgba(232,163,61,0.28)]",
                )}
              >
                {group.value ? activeLabel : group.label}
              </Button>
              {isOpen ? (
                <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-60 rounded-[20px] border border-line bg-panel p-2 shadow-panel backdrop-blur-2xl">
                  {group.options.map((option) => (
                    <button
                      key={option.value || "all"}
                      type="button"
                      onClick={() => {
                        group.onSelect(option.value);
                        setOpenGroup(null);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[14px] px-3.5 py-2.5 text-left text-[14px] transition",
                        option.value === group.value
                          ? "bg-[rgba(232,163,61,0.14)] text-text"
                          : "text-muted hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]",
                      )}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
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
