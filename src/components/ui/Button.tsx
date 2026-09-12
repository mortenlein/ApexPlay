import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none rounded-sm mds-tap";

const variants: Record<Variant, string> = {
  primary: "mds-btn-primary",
  secondary: "mds-btn-secondary",
  ghost:
    "text-fg-muted hover:text-fg hover:bg-tint border border-transparent",
  danger:
    "bg-danger text-white hover:opacity-90 border border-transparent",
};

const sizes: Record<Size, string> = {
  sm: "text-meta px-3 h-8",
  md: "text-body px-4 h-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Standard ApexPlay button. Wraps the .mds-btn-* utility classes for consistency.
 *
 * Label case is the caller's business, but the house rule still applies: a button that says
 * what it does ("Generate bracket") is a label and may be uppercase; a button carrying a name
 * a human typed is content and must not be.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", type, ...props }, ref) => (
    <button
      ref={ref}
      // Unset `type` in a <form> means "submit" — a footgun on every non-submit button.
      type={type ?? "button"}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";
