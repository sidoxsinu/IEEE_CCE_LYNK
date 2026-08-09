import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-2">
        {label && (
          <label className="font-heading font-semibold text-sm text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`neo-input ${error ? "border-error" : ""} ${className}`.trim()}
          {...props}
        />
        {error && <span className="text-sm font-semibold text-error">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
