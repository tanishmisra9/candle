import { forwardRef, type InputHTMLAttributes } from "react";

import clsx from "clsx";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "min-h-11 w-full rounded-panel border border-line-strong bg-panel px-4 py-3 text-[16px] text-text placeholder:text-muted transition-colors hover:border-text/60",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
