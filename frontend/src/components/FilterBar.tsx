import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/cn";
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
};

export function FilterBar({
  groups,
  searchValue,
  onSearchChange,
  searchPlaceholder,
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
      className="glass-nav sticky top-[88px] z-30 flex flex-col gap-3 rounded-[20px] px-4 py-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const isOpen = openGroup === group.label;
          const isActive = group.value !== "";
          const activeLabel =
            group.options.find((option) => option.value === group.value)?.label || "All";

          return (
            <div key={group.label} className="relative">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                className={cn(
                  "min-w-[104px] justify-between px-3.5 py-2.5 text-[13px]",
                  isOpen && "border-[rgba(232,163,61,0.28)]",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  {group.label}
                </span>
                <span className="max-w-[96px] truncate text-muted">{activeLabel}</span>
              </Button>
              {isOpen ? (
                <div className="absolute left-0 top-[calc(100%+10px)] w-56 rounded-[18px] border border-line bg-panel p-2 shadow-panel backdrop-blur-2xl">
                  {group.options.map((option) => (
                    <button
                      key={option.value || "all"}
                      type="button"
                      onClick={() => {
                        group.onSelect(option.value);
                        setOpenGroup(null);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[13px] transition",
                        option.value === group.value
                          ? "bg-[rgba(232,163,61,0.14)] text-text"
                          : "text-muted hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]",
                      )}
                    >
                      <span>{option.label}</span>
                      {option.value === group.value ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative w-full md:max-w-[320px]">
        <Search
          size={16}
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
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
          ⌘K
        </span>
      </div>
    </div>
  );
}
