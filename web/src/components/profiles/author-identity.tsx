import { BadgeCheck } from "lucide-react";
import type { AuthorIdentity as Author } from "@/types/community";

export function AuthorIdentity({ author }: { author: Author }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="avatar" data-accent={author.accent}>{author.initials}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <strong className="truncate text-xs font-semibold text-foreground sm:text-sm">{author.username}</strong>
          {author.verified && <BadgeCheck className="size-3.5 shrink-0 text-cyan" aria-label="Verified" />}
          {author.labels.slice(0, 1).map((label) => <span key={label} className="identity-label">{label}</span>)}
        </span>
      </span>
    </div>
  );
}