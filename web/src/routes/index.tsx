import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostFeed } from "@/components/posts/post-feed";
import { postsService } from "@/services/posts";
import { useSite } from "@/hooks/use-site";
import type { Category, PostSummary } from "@/types/community";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketplace — Browse Tools & Premium Accounts" },
      { name: "description", content: "Discover verified tools, premium accounts and daily drops." },
      { property: "og:title", content: "Marketplace — Browse Tools & Premium Accounts" },
      { property: "og:description", content: "Discover verified tools, premium accounts and daily drops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const toneDot: Record<string, string> = {
  rose: "bg-pink-400",
  crimson: "bg-rose-500",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
};

function CategoryRail({ categories, isLoading }: { categories: Category[]; isLoading: boolean }) {
  return (
    <aside className="rgs-sidebar">
      <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        Categories
      </p>
      {isLoading && <p className="px-3 text-xs text-muted-foreground">Loading…</p>}
      {!isLoading && categories.length === 0 && (
        <p className="px-3 text-xs text-muted-foreground">No categories yet.</p>
      )}
      {categories.map((category) => (
        <Link
          key={category.id}
          to="/category/$categoryId"
          params={{ categoryId: category.id }}
          className="rgs-side-link"
        >
          <span className={`rgs-side-dot ${toneDot[category.tone] ?? "bg-indigo-500"}`} />
          <span className="min-w-0 truncate">{category.name}</span>
        </Link>
      ))}
      <div className="rgs-plan-card mt-6">
        <p className="text-[.68rem] opacity-80">Current plan</p>
        <p className="font-display text-lg font-bold">Member</p>
        <Link
          to="/settings"
          className="mt-3 block w-full rounded-xl border border-white/30 bg-white/20 py-2 text-center text-[.66rem] font-extrabold uppercase tracking-tight backdrop-blur-md transition-colors hover:bg-white/30"
        >
          View benefits
        </Link>
      </div>
    </aside>
  );
}

function Index() {
  const { siteName, ads } = useSite();
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: postsService.listCategories,
    staleTime: 60_000,
  });
  const postsQuery = useQuery({
    queryKey: ["posts", "latest"],
    queryFn: () => postsService.listLatest(50),
    staleTime: 30_000,
  });

  const categories: Category[] = categoriesQuery.data ?? [];
  const posts: PostSummary[] = postsQuery.data ?? [];
  const freshDrops = posts.filter((p) => p.access !== "premium").length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
        <CategoryRail categories={categories} isLoading={categoriesQuery.isLoading} />
        <div className="min-w-0">
          <section className="mb-10">
            <h1 className="rgs-hero-title mb-6">Marketplace Discovery</h1>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="rgs-hero">
                <div className="relative z-10 max-w-md">
                  <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                    Unlock Premium Access Across All Platforms
                  </h2>
                  <p className="mb-6 mt-3 text-sm text-white/80">
                    Browse curated tools and verified accounts, updated daily on {siteName}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/write" className="rgs-btn rgs-btn-solid">
                      <Zap className="size-4" /> Share a tool
                    </Link>
                    <a href="#latest" className="rgs-btn rgs-btn-ghost">
                      <Sparkles className="size-4" /> New releases
                    </a>
                  </div>
                </div>
              </div>
              <div className="rgs-hero-card">
                <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-emerald-100">
                  <CheckCircle2 className="size-7 text-emerald-600" />
                </div>
                <h3 className="font-display text-xl font-bold">Daily Drop</h3>
                <p className="mb-5 mt-1 text-sm text-muted-foreground">
                  {ads.length > 0
                    ? "Fresh partner offers are live right now."
                    : `${freshDrops} verified item${freshDrops === 1 ? "" : "s"} available today.`}
                </p>
                <a href="#latest" className="rgs-btn bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600">
                  Browse now
                </a>
              </div>
            </div>
          </section>
          <PostFeed posts={posts} isLoading={postsQuery.isLoading} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
