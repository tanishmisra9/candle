import { useLayoutEffect, useState } from "react";

/**
 * Whether `node` (a `line-clamp-N` element) is actually cutting its text: it overflows its own box. Re-measured when the text or the
 * element's size changes. The phone dialogs repeat the whole title in the body only when this is true; a short title used to be
 * shown twice, 66px apart. (jsdom has no layout, so it reports false unless a test defines scrollHeight/clientHeight.)
 */
export function useIsClamped(node: HTMLElement | null, text: string) {
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    if (!node) {
      setClamped(false);
      return;
    }
    const measure = () => setClamped(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, text]);

  return clamped;
}
