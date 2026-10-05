import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  showClear?: boolean;
  fieldName?: string;
  requiredMessage?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", onClear, showClear, fieldName, requiredMessage, value, onChange, autoComplete = "off", onInvalid, onInput, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const canClear = Boolean(showClear || onClear) && hasValue && !props.disabled && !props.readOnly;

    const getFieldLabel = () => {
      if (fieldName) return fieldName;
      if (props.id) {
        const cleanId = props.id.replace(/^(login|register|onboarding|admin)[-_]/i, '');
        if (cleanId) {
          return cleanId
            .replace(/([A-Z])/g, ' $1')
            .replace(/[-_]/g, ' ')
            .replace(/^./, str => str.toUpperCase())
            .trim();
        }
      }
      if (props.name) {
        return props.name
          .replace(/([A-Z])/g, ' $1')
          .replace(/[-_]/g, ' ')
          .replace(/^./, str => str.toUpperCase())
          .trim();
      }
      if (type === 'email') return 'Email Address';
      if (type === 'password') return 'Password';
      if (type === 'tel') return 'Phone Number';
      if (props.placeholder && !props.placeholder.startsWith('e.g.') && !props.placeholder.includes('•')) {
        return props.placeholder;
      }
      return 'this field';
    };

    const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
      const target = e.currentTarget;
      const label = getFieldLabel();
      if (target.validity.valueMissing) {
        target.setCustomValidity(requiredMessage || `Please fill out ${label}`);
      } else if (target.validity.typeMismatch && type === 'email') {
        target.setCustomValidity(`Please enter a valid Email Address`);
      } else if (target.validity.tooShort) {
        target.setCustomValidity(`${label} must be at least ${target.minLength} characters`);
      } else {
        target.setCustomValidity('');
      }
      onInvalid?.(e);
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      e.currentTarget.setCustomValidity('');
      onInput?.(e as any);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.currentTarget.setCustomValidity('');
      onChange?.(e);
    };

    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
          currentTarget: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    if (canClear) {
      return (
        <div className="relative w-full">
          <input
            type={type}
            value={value}
            onChange={handleChange}
            onInvalid={handleInvalid}
            onInput={handleInput}
            autoComplete={autoComplete}
            className={cn(
              "flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              className
            )}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Clear text"
            aria-label="Clear input text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <input
        type={type}
        value={value}
        onChange={handleChange}
        onInvalid={handleInvalid}
        onInput={handleInput}
        autoComplete={autoComplete}
        className={cn(
          "flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

