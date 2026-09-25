import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryStrip } from "@/components/categories/category-strip";
import { CommunityHero } from "@/components/hero/community-hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostFeed } from "@/components/posts/post-feed";
import { postsService } from "@/services/posts";
import type { Category, PostSummary } from "@/types/community";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CORALZ — Share Knowledge. Access the Best." },
      { name: "description", content: "Discover methods, resources, and community knowledge on CORALZ." },
      { property: "og:title", content: "CORALZ — Premium Community" },
      { property: "og:description", content: "Discover methods, resources, and community knowledge on CORALZ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: postsService.listCategories,
    staleTime: 60_000,
  });
  const postsQuery = useQuery({
    queryKey: ["posts", "latest"],
    queryFn: () => postsService.listLatest({ limit: 50 }),
    staleTime: 30_000,
  });

  const categories: Category[] = categoriesQuery.data ?? [];
  const posts: PostSummary[] = postsQuery.data ?? [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main>
        <CommunityHero />
        <CategoryStrip categories={categories} isLoading={categoriesQuery.isLoading} />
        <PostFeed posts={posts} isLoading={postsQuery.isLoading} />
      </main>
      <SiteFooter />
    </div>
  );
}

