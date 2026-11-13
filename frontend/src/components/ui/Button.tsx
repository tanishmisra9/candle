import { forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import clsx from "clsx";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        className={clsx(
          "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-panel text-[14px] font-medium transition-colors duration-150 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-accent-fill px-5 py-3 text-accent-on hover:bg-accent-fill-hover active:bg-accent-fill-pressed disabled:bg-line disabled:text-muted",
          variant === "secondary" &&
            "border border-line-strong bg-panel px-5 py-3 text-text hover:bg-text/5",
          variant === "ghost" && "px-3.5 py-2.5 text-muted hover:bg-text/5 hover:text-text",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
