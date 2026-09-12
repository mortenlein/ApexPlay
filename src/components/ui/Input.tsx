import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Icon rendered inside the field's leading edge (a search glyph, a flag). */
  icon?: React.ReactNode;
}

/** Labelled text input wrapping the .mds-input utility. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, icon, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    const hintId = hint && inputId ? `${inputId}-hint` : undefined;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="mds-uppercase-label">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={hintId}
            className={`mds-input ${icon ? "pl-9" : ""} ${className}`}
            {...props}
          />
        </div>
        {hint && (
          <p id={hintId} className="text-meta text-fg-subtle">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
