import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

/** Labelled text input wrapping the .mds-input utility. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="mds-uppercase-label">
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} className={`mds-input ${className}`} {...props} />
        {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
