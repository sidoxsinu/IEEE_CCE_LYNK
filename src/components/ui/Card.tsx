import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hoverable = false, ...props }, ref) => {
    const baseClass = "neo-card";
    const hoverClass = hoverable ? "neo-card-hoverable cursor-pointer" : "";
    const combinedClassName = `${baseClass} ${hoverClass} ${className}`.trim();

    return (
      <div ref={ref} className={combinedClassName} {...props} />
    );
  }
);
Card.displayName = "Card";
