import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none rounded-sm";

const variants: Record<Variant, string> = {
  primary: "mds-btn-primary",
  secondary: "mds-btn-secondary",
  ghost:
    "text-fg-muted hover:text-fg hover:bg-white/5 border border-transparent",
  danger:
    "bg-danger text-white hover:opacity-90 border border-transparent",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 h-8",
  md: "text-sm px-4 h-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Standard ApexPlay button. Wraps the .mds-btn-* utility classes for consistency. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";
