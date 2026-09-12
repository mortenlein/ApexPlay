import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** Surface container. `interactive` adds the hover treatment used on clickable cards. */
export function Card({ interactive = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`mds-card ${
        interactive
          ? "cursor-pointer hover:border-line-hover hover:bg-card-hover"
          : "hover:transform-none hover:shadow-none hover:border-line"
      } ${className}`}
      {...props}
    />
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level. Cards usually sit under a section heading, so h3 is the default. */
  as?: "h2" | "h3" | "h4";
  /** Cap the title at two lines instead of letting it wrap freely (dense rails only). */
  clamp?: boolean;
}

/**
 * The default card heading.
 *
 * A card title is nearly always a name a human typed — a team, a player, a tournament — so it
 * defaults to `.mds-card-title` (display face, the user's own casing, no tracking, wraps)
 * rather than the uppercase-tracked treatment that belongs on labels. If your card's title is
 * a *label* ("Server settings"), `.mds-uppercase-label` is the right class instead.
 */
export function CardTitle({ as = "h3", clamp = false, className = "", ...props }: CardTitleProps) {
  const Tag = as;
  return <Tag className={`mds-card-title ${clamp ? "mds-clamp-2" : ""} ${className}`} {...props} />;
}
