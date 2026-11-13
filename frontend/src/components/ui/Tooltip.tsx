import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  label: string;
  /** A single element that is itself focusable (button / link). Never wrap non-focusable text. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /**
   * Set false when `label` repeats the trigger's own accessible name (icon buttons), so screen
   * readers don't announce it twice.
   */
  describe?: boolean;
  /** Classes for the wrapper span (e.g. `min-w-0 max-w-full` when the trigger truncates). */
  className?: string;
};

const HOVER_DELAY_MS = 400;
const CLOSE_GRACE_MS = 120;
const GAP = 8;
const EDGE = 8;

/**
 * Supplementary hint for sighted mouse and keyboard users (WCAG 1.4.13): dismissible with Escape,
 * hoverable (the pointer can move onto the bubble), persistent until hover/focus leaves.
 * Opens on mouse hover and keyboard focus only. Taps are ignored so a tooltip never competes with
 * the trigger's own action on touch. Never put essential information only in a tooltip.
 * Never wrap a trigger that sits inside another interactive element (nested-interactive).
 */
export function Tooltip({ label, children, describe = true, className }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };
  const show = useCallback(() => {
    clearTimers();
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPosition(null);
  }, []);
  const scheduleHide = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(hide, CLOSE_GRACE_MS);
  };

  useEffect(() => clearTimers, []);

  // Dismiss on Escape (WCAG 1.4.13), scroll and resize (the anchor moves out from under it).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  // Place below the trigger, flip above when there is no room, clamp inside the viewport.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !bubbleRef.current) return;
    const anchor = triggerRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();
    const fitsBelow = anchor.bottom + GAP + bubble.height <= window.innerHeight - EDGE;
    const top = fitsBelow ? anchor.bottom + GAP : Math.max(EDGE, anchor.top - GAP - bubble.height);
    const centered = anchor.left + anchor.width / 2 - bubble.width / 2;
    const left = Math.min(Math.max(EDGE, centered), window.innerWidth - bubble.width - EDGE);
    setPosition({ top, left });
  }, [open, label]);

  const mouseOnly = (handler: () => void) => (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") handler();
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={className ?? "inline-flex"}
        onPointerEnter={mouseOnly(() => {
          window.clearTimeout(closeTimer.current);
          openTimer.current = window.setTimeout(show, HOVER_DELAY_MS);
        })}
        onPointerLeave={mouseOnly(scheduleHide)}
        onFocus={(event) => {
          // Focus from a mouse click is not a keyboard focus: only show for :focus-visible.
          if ((event.target as HTMLElement).matches?.(":focus-visible")) show();
        }}
        onBlur={hide}
      >
        {cloneElement(children, {
          "aria-describedby": open && describe ? id : children.props["aria-describedby"],
        })}
      </span>
      {open
        ? createPortal(
            <div
              ref={bubbleRef}
              id={id}
              role="tooltip"
              onPointerEnter={mouseOnly(() => window.clearTimeout(closeTimer.current))}
              onPointerLeave={mouseOnly(scheduleHide)}
              style={{
                position: "fixed",
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? "visible" : "hidden",
              }}
              className="z-[80] w-max max-w-[min(18rem,calc(100vw-1rem))] rounded-panel border border-line-strong bg-panel px-2.5 py-1.5 text-[12px] font-medium leading-snug text-text shadow-[3px_3px_0_rgb(var(--line-strong)/0.5)]"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
