import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** Surface container. `interactive` adds the hover lift used on clickable cards. */
export function Card({ interactive = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`mds-card ${interactive ? "cursor-pointer" : "hover:transform-none hover:shadow-none hover:border-line"} ${className}`}
      {...props}
    />
  );
}
