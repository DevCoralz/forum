import { apiRequest } from "@/services/api";
import {
  toCategory,
  toComment,
  toPostDetail,
  toPostSummary,
  type RawCategory,
  type RawComment,
  type RawPostDetail,
  type RawPostSummary,
  type RawSubcategory,
} from "@/services/mappers";
import type { Category, CreatePostInput, PostComment, PostDetail, PostSummary } from "@/types/community";

const json = { "Content-Type": "application/json" };

let categoryNames: Map<string, string> = new Map();

function rememberCategories(raw: RawCategory[]) {
  categoryNames = new Map(raw.map((item) => [item.id, item.name]));
}

async function ensureCategoryNames() {
  if (categoryNames.size) return categoryNames;
  try {
    // /posts/categories returns the base list; category names are always available.
    const raw = await apiRequest<RawCategory[]>("/posts/categories");
    rememberCategories(raw);
  } catch {
    /* names fall back to "General" */
  }
  return categoryNames;
}

export interface ListPostsOptions {
  access?: "all" | "free" | "premium";
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export const postsService = {
  /**
   * Fetch categories. Includes post_count when the backend has the counts
   * endpoint data; otherwise post_count is 0.
   */
  listCategories: async (): Promise<Category[]> => {
    // Prefer the counts endpoint; fall back to the plain list if not available.
    let raw: RawCategory[];
    try {
      raw = await apiRequest<RawCategory[]>("/posts/categories/counts");
    } catch {
      raw = await apiRequest<RawCategory[]>("/posts/categories");
    }
    rememberCategories(raw);
    return raw.map(toCategory);
  },

  listSubcategories: async (categoryId: string) =>
    apiRequest<RawSubcategory[]>(
      `/posts/categories/${encodeURIComponent(categoryId)}/subcategories`,
    ),

  listLatest: async (options: ListPostsOptions = {}): Promise<PostSummary[]> => {
    const params = new URLSearchParams({ sort: "latest" });
    if (options.categoryId) params.set("category_id", options.categoryId);
    if (options.access && options.access !== "all") params.set("post_type", options.access);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));

    const [raw, names] = await Promise.all([
      apiRequest<RawPostSummary[]>(`/posts?${params.toString()}`),
      ensureCategoryNames(),
    ]);
    const mapped = raw.map((item) => toPostSummary(item, names));
    if (options.access && options.access !== "all") {
      return mapped.filter((post) => post.access === options.access);
    }
    return mapped;
  },

  /**
   * List posts by a specific author.
   * The backend doesn't have an author-filter query param, so we fetch the full
   * latest list and filter client-side. For large datasets wire a dedicated
   * backend filter.
   */
  listByAuthor: async (username: string): Promise<PostSummary[]> => {
    const [raw, names] = await Promise.all([
      apiRequest<RawPostSummary[]>(`/posts?sort=latest&limit=50`),
      ensureCategoryNames(),
    ]);
    return raw
      .map((item) => toPostSummary(item, names))
      .filter((post) => post.author.username === username);
  },

  getPost: async (id: string): Promise<PostDetail> => {
    const [raw, names] = await Promise.all([
      apiRequest<RawPostDetail>(`/posts/${encodeURIComponent(id)}`),
      ensureCategoryNames(),
    ]);
    return toPostDetail(raw, names);
  },

  listComments: async (id: string): Promise<PostComment[]> => {
    const raw = await apiRequest<RawComment[]>(`/posts/${encodeURIComponent(id)}/comments`);
    return raw.map(toComment);
  },

  addComment: async (id: string, body: string): Promise<PostComment> => {
    const raw = await apiRequest<RawComment>(
      `/posts/${encodeURIComponent(id)}/comments`,
      { method: "POST", headers: json, body: JSON.stringify({ content: body }) },
    );
    return toComment(raw);
  },

  toggleLike: (id: string) =>
    apiRequest<{ liked: boolean; like_count?: number }>(
      `/posts/${encodeURIComponent(id)}/like`,
      { method: "POST" },
    ),

  createPost: (input: CreatePostInput) =>
    apiRequest<{ id: string; slug: string }>("/posts", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        title: input.title,
        content: input.body,
        category_id: input.categoryId,
        ...(input.subcategory ? { subcategory_name: input.subcategory } : {}),
        post_type: input.audience === "premium" ? "premium" : "free",
      }),
    }),

  deletePost: (id: string) =>
    apiRequest<void>(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listSimilar: async (id: string): Promise<PostSummary[]> => {
    const [raw, names] = await Promise.all([
      apiRequest<RawPostSummary[]>(`/posts/${encodeURIComponent(id)}/similar?limit=10`),
      ensureCategoryNames(),
    ]);
    return raw.map((item) => toPostSummary(item, names));
  },
};
