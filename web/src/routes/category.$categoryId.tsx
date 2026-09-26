import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/categories/category-page";

type CategorySearch = { sub?: string | undefined };

export const Route = createFileRoute("/category/$categoryId")({
  validateSearch: (search: Record<string, unknown>): CategorySearch => ({
    sub: typeof search["sub"] === "string" ? search["sub"] : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Category · ${params.categoryId}` },
      { name: "description", content: "Browse tools and subcategories in this category." },
      { property: "og:title", content: `Category · ${params.categoryId}` },
      { property: "og:description", content: "Browse tools and subcategories in this category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoryPage,
});
