import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[14px] font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "rounded-full bg-accent px-5 py-3 text-[#2B1902] shadow-panel hover:bg-accent-hover active:bg-accent-pressed",
        variant === "secondary" &&
          "rounded-full border border-line bg-glass px-5 py-3 text-text backdrop-blur-2xl hover:bg-[rgba(255,255,255,0.82)] dark:hover:bg-[rgba(30,30,36,0.82)]",
        variant === "ghost" &&
          "rounded-xl px-3.5 py-2.5 text-muted hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
