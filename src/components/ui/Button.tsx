import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
    const baseClass = "neo-button";
    const variantClass = variant === "secondary" ? "neo-button-secondary" : "";
    const loadingClass = isLoading ? "opacity-80 cursor-wait" : "";
    const combinedClassName = `${baseClass} ${variantClass} ${loadingClass} ${className}`.trim();

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        data-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="w-5 h-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" className="opacity-75" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
