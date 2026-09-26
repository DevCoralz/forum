import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { AuthorIdentity as Author } from "@/types/community";

export function AuthorIdentity({ author }: { author: Author }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="avatar" data-accent={author.accent}>{author.initials}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <strong className="truncate text-xs font-semibold text-foreground sm:text-sm">{author.username}</strong>
          {author.verified && <VerifiedBadge />}
          {(author.badges ?? author.labels.map((name) => ({ name, color: "#666666" }))).slice(0, 2).map((badge) => (
            <span key={badge.name} className="tag-shimmer" style={{ "--tag-color": badge.color } as React.CSSProperties}>{badge.name}</span>
          ))}
        </span>
      </span>
    </div>
  );
}
