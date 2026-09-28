import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Users, Eye, Radio,
  ChevronRight, Zap, Plus, X,
  Flame, Settings, Crown, Database, Cookie, FileText, Grid2X2, Layers,
} from "lucide-react";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { postsService } from "@/services/posts";
import { useSite } from "@/hooks/use-site";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/services/api";
import { WhatsAppIcon, TelegramIcon } from "@/components/icons/social-icons";
import { PostFeed } from "@/components/posts/post-feed";
import type { Category } from "@/types/community";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home" },
      { name: "description", content: "Tools, premium accounts, and daily drops." },
    ],
  }),
  component: Index,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

const CAT_ICONS: Record<string, typeof Layers> = {
  flame:    Flame,
  settings: Settings,
  crown:    Crown,
  database: Database,
  cookie:   Cookie,
  file:     FileText,
  grid:     Grid2X2,
};

const CARD_GRADIENTS: Record<string, string> = {
  rose:    "from-rose-500/20 to-pink-400/10 border-rose-300/40",
  crimson: "from-rose-600/20 to-red-400/10 border-red-300/40",
  cyan:    "from-cyan-500/20 to-sky-400/10 border-cyan-300/40",
  violet:  "from-violet-500/20 to-purple-400/10 border-violet-300/40",
  emerald: "from-emerald-500/20 to-teal-400/10 border-emerald-300/40",
  amber:   "from-amber-400/25 to-yellow-300/15 border-amber-300/60",
  blue:    "from-blue-500/20 to-indigo-400/10 border-blue-300/40",
};

const ICON_BG: Record<string, string> = {
  rose:    "bg-rose-100 text-rose-500",
  crimson: "bg-red-100 text-red-500",
  cyan:    "bg-cyan-100 text-cyan-600",
  violet:  "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber:   "bg-amber-100 text-amber-500",
  blue:    "bg-blue-100 text-blue-600",
};

// ── sub-components ────────────────────────────────────────────────────────────

/** Single stat pill — icon background stripped per design */
function StatPill({
  icon: Icon,
  label,
  value,
  valueClass = "hz-stat-value",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="hz-stat-pill">
      {/* no background on the icon wrapper */}
      <div className="hz-stat-icon-bare">
        <Icon className="size-4 text-white/50" />
      </div>
      <div className="min-w-0">
        <p className="hz-stat-label">{label}</p>
        <p className={valueClass}>{value}</p>
      </div>
    </div>
  );
}

function CategoryCard({ cat, onClick }: { cat: Category; onClick: () => void }) {
  const gradient = CARD_GRADIENTS[cat.tone] ?? CARD_GRADIENTS.blue;
  const iconBg   = ICON_BG[cat.tone]      ?? ICON_BG.blue;
  const IconComp = CAT_ICONS[cat.icon]    ?? Layers;
  return (
    <button
      onClick={onClick}
      className={`hz-cat-card bg-gradient-to-br ${gradient}${cat.tone === "amber" ? " hz-cat-amber" : ""}`}
    >
      <div className={`hz-cat-icon ${iconBg}`}>
        {cat.iconUrl ? (
          <img src={cat.iconUrl} alt="" className="size-5 object-contain" />
        ) : (
          <IconComp className="size-5" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="hz-cat-name">{cat.name}</p>
        <p className="hz-cat-count">{cat.postCount} posts</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </button>
  );
}

/** WhatsApp + Telegram FAB only — real brand icons */
function SocialFAB({ socials }: { socials: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only keep WhatsApp and Telegram
  const entries: [string, string][] = (["whatsapp", "telegram"] as const)
    .map((k) => [k, socials[k] ?? ""] as [string, string])
    .filter(([, v]) => v.trim());

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div ref={ref} className="hz-fab-wrap">
      {open && (
        <div className="hz-fab-tray">
          {entries.map(([key, url]) => {
            const Icon = key === "whatsapp" ? WhatsAppIcon : TelegramIcon;
            const hoverCls = key === "whatsapp"
              ? "hover:bg-emerald-500"
              : "hover:bg-sky-500";
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={key === "whatsapp" ? "WhatsApp" : "Telegram"}
                className={`hz-fab-item ${hoverCls}`}
              >
                <Icon className="size-5" />
              </a>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="hz-fab-btn"
        aria-label="Community links"
      >
        {open ? <X className="size-5" /> : <Radio className="size-5" />}
      </button>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

function Index() {
  const { siteName, settings } = useSite();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socials: Record<string, string> = settings.site_socials ?? {};

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: postsService.listCategories,
    staleTime: 60_000,
  });

  const statsQ = useQuery({
    queryKey: ["site-stats"],
    queryFn: () => apiRequest<{ total_users: number; total_posts: number; live_visitors: number }>("/site/stats"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Filter out threads category for everyone; filter posts for non-admins (admins see all)
  const categories: Category[] = (categoriesQ.data ?? [])
    .filter((c) => !c.isHidden && c.slug !== "threads");

  const stats = statsQ.data;

  const [firstName, ...rest] = siteName.split(" ");

  // Visitor value: "3 Online" format, green
  const visitorsValue = stats
    ? stats.live_visitors > 0
      ? `${stats.live_visitors} Online`
      : "Online"
    : "—";

  return (
    <div className="hz-page">
      <SiteHeader />

      <main className="hz-main">
        {/* ── Hero card ───────────────────────────────────────────────── */}
        <div className="hz-hero-card">
          {/* welcome chip */}
          {user && (
            <div className="hz-welcome-chip">
              <Zap className="size-3.5 text-primary" />
              <span>Welcome, {user.username}</span>
            </div>
          )}

          {/* site name headline */}
          <h1 className="hz-hero-title">
            <span className="hz-hero-first">{firstName}</span>
            {rest.length > 0 && (
              <span className="hz-hero-rest">.{rest.join(" ")}</span>
            )}
          </h1>

          <p className="hz-hero-sub">
            {settings.site_description?.trim() ||
              "Underground tools, premium accounts & daily drops — all in one place."}
          </p>

          {/* CTAs */}
          <div className="hz-hero-actions">
            {isAdmin ? (
              <Link to="/write" className="hz-pill-btn hz-pill-primary">
                <Plus className="size-4" /> Share a tool
              </Link>
            ) : user ? (
              <Link to="/share" className="hz-pill-btn hz-pill-primary">
                <Plus className="size-4" /> Share a tool
              </Link>
            ) : (
              <Link to="/signup" className="hz-pill-btn hz-pill-primary">
                <Zap className="size-4" /> Join now
              </Link>
            )}
            <a href="#categories" className="hz-pill-btn hz-pill-ghost">
              <Layers className="size-4" /> Browse categories
            </a>
          </div>

          {/* stat cards — redesigned per spec */}
          <div className="hz-stats-row">
            {/* Total Users — white value */}
            <StatPill
              icon={Users}
              label="Total Users"
              value={stats ? fmt(stats.total_users) : "—"}
              valueClass="hz-stat-value hz-stat-white"
            />
            {/* Resources — purple value */}
            <StatPill
              icon={Eye}
              label="Resources"
              value={stats ? `${fmt(stats.total_posts)}+` : "—"}
              valueClass="hz-stat-value hz-stat-purple"
            />
            {/* Site Visitors — green value, "X Online" format */}
            <StatPill
              icon={Radio}
              label="Site Visitors"
              value={visitorsValue}
              valueClass="hz-stat-value hz-stat-green"
            />
          </div>
        </div>

        {/* ── Categories grid ─────────────────────────────────────────── */}
        <section id="categories" className="hz-section">
          <h2 className="hz-section-title">Categories</h2>

          {categoriesQ.isLoading && (
            <div className="hz-cat-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="hz-cat-card hz-cat-skeleton" />
              ))}
            </div>
          )}

          {!categoriesQ.isLoading && categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No categories yet.
            </p>
          )}

          {categories.length > 0 && (
            <div className="hz-cat-grid">
              {categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  onClick={() =>
                    navigate({ to: "/category/$categoryId", params: { categoryId: cat.id } })
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Posts feed — admin-only visibility ──────────────────────── */}
        {isAdmin && (
          <section id="latest" className="hz-section">
            <h2 className="hz-section-title">Latest Posts</h2>
            <PostFeed />
          </section>
        )}
      </main>

      <SiteFooter />

      {/* floating social FAB */}
      <SocialFAB socials={socials} />
    </div>
  );
}

