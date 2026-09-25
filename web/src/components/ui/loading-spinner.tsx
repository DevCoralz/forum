import { Loader2 } from "lucide-react";

/** Circular-only loading indicator. Never carries text, per site convention. */
export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`} role="status" aria-label="Loading">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
    </div>
  );
}
