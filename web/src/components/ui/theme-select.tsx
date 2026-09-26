import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Themed dropdown used everywhere instead of the native browser <select>. */
const EMPTY = "__empty__";

export function ThemeSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  // Radix Select forbids "" as an item value, so map it to a sentinel.
  const toInner = (v: string) => (v === "" ? EMPTY : v);
  return (
    <Select value={toInner(value)} onValueChange={(v) => onChange(v === EMPTY ? "" : v)}>
      <SelectTrigger aria-label={ariaLabel} className={cn("admin-input h-9", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[200] border-border bg-popover text-popover-foreground">
        {options.map((option) => (
          <SelectItem key={option.value || EMPTY} value={toInner(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
