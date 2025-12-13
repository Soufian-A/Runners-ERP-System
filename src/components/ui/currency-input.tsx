import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  currency: 'USD' | 'LBP';
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currency, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format number with commas
    const formatNumber = (num: string, isUSD: boolean): string => {
      if (!num || num === "") return "";
      
      // Remove all non-numeric characters except decimal point
      const cleanValue = num.replace(/[^\d.]/g, "");
      
      if (cleanValue === "") return "";
      
      const parts = cleanValue.split(".");
      const integerPart = parts[0];
      const decimalPart = parts[1];
      
      // Add commas to integer part
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      
      if (isUSD && decimalPart !== undefined) {
        return `${formattedInteger}.${decimalPart.slice(0, 2)}`;
      }
      
      return formattedInteger;
    };

    // Parse formatted string back to raw number
    const parseNumber = (formatted: string): string => {
      return formatted.replace(/,/g, "");
    };

    // Update display when external value changes
    React.useEffect(() => {
      if (value) {
        setDisplayValue(formatNumber(value, currency === 'USD'));
      } else {
        setDisplayValue("");
      }
    }, [value, currency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow only numbers, commas, and decimal point (for USD)
      const allowedPattern = currency === 'USD' ? /^[\d,.]*$/ : /^[\d,]*$/;
      if (!allowedPattern.test(inputValue)) return;
      
      const rawValue = parseNumber(inputValue);
      const formatted = formatNumber(rawValue, currency === 'USD');
      
      setDisplayValue(formatted);
      onChange(rawValue);
    };

    const handleBlur = () => {
      // Ensure proper formatting on blur
      if (value) {
        setDisplayValue(formatNumber(value, currency === 'USD'));
      }
    };

    const prefix = currency === 'USD' ? '$' : '';
    const suffix = currency === 'LBP' ? ' LBP' : '';

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            "h-8 text-xs font-mono",
            prefix && "pl-5",
            suffix && "pr-10",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
