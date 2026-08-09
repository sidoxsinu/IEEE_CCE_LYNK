import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "error" | "warning" | "default";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const baseClass = "neo-badge";
    const variantClass = variant !== "default" ? `neo-badge-${variant}` : "";
    const combinedClassName = `${baseClass} ${variantClass} ${className}`.trim();

    return <span ref={ref} className={combinedClassName} {...props} />;
  }
);
Badge.displayName = "Badge";
