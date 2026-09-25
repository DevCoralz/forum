import { Cookie, Crown, Database, FileText, Flame, Grid2X2, Settings } from "lucide-react";
import type { Category } from "@/types/community";

const icons = { flame: Flame, settings: Settings, crown: Crown, database: Database, cookie: Cookie, file: FileText, grid: Grid2X2 };

export function CategoryStrip({ categories, isLoading = false }: { categories: Category[]; isLoading?: boolean }) {
  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="section-title">Browse Categories</h2>
        <a className="text-xs font-medium text-primary" href="#latest">View all →</a>
      </div>
      <div className="scrollbar-none flex snap-x gap-2.5 overflow-x-auto pb-2">
        {isLoading &&
          [0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="category-pill animate-pulse" data-tone="cyan">
              <span className="category-icon bg-surface/50" />
              <span className="text-left"><strong className="block h-3 w-20 rounded bg-surface" /><small className="mt-1 block h-2 w-12 rounded bg-surface/70" /></span>
            </div>
          ))}
        {!isLoading && categories.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Categories will appear as soon as the server responds.</p>
        )}
        {categories.map((category) => {
          const Icon = icons[category.icon];
          return (
            <a key={category.id} href="#latest" className="category-pill group" data-tone={category.tone}>
              <span className="category-icon"><Icon /></span>
              <span className="text-left"><strong>{category.name}</strong><small>{category.postCount >= 1000 ? `${(category.postCount / 1000).toFixed(1)}k` : category.postCount} posts</small></span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
