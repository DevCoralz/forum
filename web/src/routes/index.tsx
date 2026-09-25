import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryStrip } from "@/components/categories/category-strip";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostFeed } from "@/components/posts/post-feed";
import { postsService } from "@/services/posts";
import type { Category, PostSummary } from "@/types/community";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "I2P Forum — Forum Index" },
      { name: "description", content: "Browse I2P Forum categories and recent discussions." },
      { property: "og:title", content: "I2P Forum — Forum Index" },
      { property: "og:description", content: "Browse I2P Forum categories and recent discussions." },
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
        <section id="top" className="forum-masthead">
          <div>
            <p>Forum index</p>
            <h1>I2P <span>Forum</span></h1>
            <small>Recent posts and member discussions.</small>
          </div>
          <dl><div><dt>Access</dt><dd>Member</dd></div><div><dt>Status</dt><dd>Online</dd></div></dl>
        </section>
        <CategoryStrip categories={categories} isLoading={categoriesQuery.isLoading} />
        <PostFeed posts={posts} isLoading={postsQuery.isLoading} />
      </main>
      <SiteFooter />
    </div>
  );
}

