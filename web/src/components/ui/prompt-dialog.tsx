import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeSelect } from "@/components/ui/theme-select";

export interface PromptField {
  key: string;
  label: string;
  type?: "text" | "password" | "number" | "url" | "textarea" | "select" | "color";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  hint?: string;
  options?: { value: string; label: string }[];
}

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields?: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /** Receives the collected field values; the parent decides how to submit. */
  onSubmit: (values: Record<string, string>) => void;
}

/** Themed replacement for window.prompt — never use native browser dialogs. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  fields = [],
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  pending = false,
  onSubmit,
}: PromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Start from the field defaults each time the dialog opens.
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const field of fields) initial[field.key] = field.defaultValue ?? "";
      setValues(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-base text-foreground">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm">{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          {fields.map((field) => (
            <label key={field.key} className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  className="admin-input min-h-20 w-full"
                  rows={3}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  maxLength={field.maxLength}
                />
              ) : field.type === "select" ? (
                <ThemeSelect
                  className="w-full"
                  ariaLabel={field.label}
                  value={values[field.key] ?? ""}
                  onChange={(next) => setValues((v) => ({ ...v, [field.key]: next }))}
                  options={field.options ?? []}
                />
              ) : field.type === "color" ? (
                <input
                  type="color"
                  className="admin-input admin-color"
                  value={values[field.key] || "#FFC928"}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  aria-label={field.label}
                />
              ) : (
                <input
                  className="admin-input w-full"
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  required={field.required}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  min={field.min}
                />
              )}
              {field.hint && <span className="text-[11px] font-normal">{field.hint}</span>}
            </label>
          ))}
          <DialogFooter className="mt-1 gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant="coralz" size="sm" disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
