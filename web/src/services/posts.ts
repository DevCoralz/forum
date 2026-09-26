import { apiRequest } from "@/services/api";
import type { PostComment } from "@/types/community";
import {
  type Category,
  type PostDetail,
  type PostSummary,
  type Subcategory,
  toCategory,
  toComment,
  toPostDetail,
  toPostSummary,
  toSubcategory,
} from "@/services/mappers";
import type { CategoryWithCountRaw } from "@/services/admin";
import type {
  RawCategory,
  RawComment,
  RawPostDetail,
  RawPostSummary,
  RawSubcategory,
} from "@/services/mappers";

/** Everything the composer collects for one post — thread or tool. */
export class CreatePostInput {
  constructor(
    public title: string,
    public content: string,
    public kind: "thread" | "tool",
    public postType: "free" | "premium",
    public categoryId?: string,
    public subcategoryIds: string[] = [],
    public price?: number,
    public fileId?: string,
    public attachmentId?: string,
    public imageIds: string[] = [],
    public tags: string[] = [],
  ) {}

  toApi() {
    const api: Record<string, unknown> = {
      title: this.title,
      content: this.content,
      kind: this.kind,
      post_type: this.postType,
      category_id: this.kind === "thread" ? undefined : this.categoryId,
      subcategory_ids: this.kind === "thread" ? [] : this.subcategoryIds,
      price: this.kind === "thread" ? undefined : this.price ?? 0,
      file_media_id: this.kind === "thread" ? undefined : this.fileId,
      attachment_media_id: this.kind === "thread" ? this.attachmentId : undefined,
      image_media_ids: this.kind === "thread" ? this.imageIds : [],
      tags: this.tags,
    };
    for (const key of Object.keys(api)) {
      if (api[key] === undefined) delete api[key];
    }
    return api;
  }
}

export const postsService = {
  /** Categories for the public site — hidden ones are excluded server-side. */
  async listCategories(): Promise<Category[]> {
    const data = await apiRequest<RawCategory[]>("/posts/categories");
    return data.map(toCategory);
  },

  async listCategoriesWithCounts(): Promise<Category[]> {
    const data = await apiRequest<CategoryWithCountRaw[]>("/posts/categories/counts");
    return data.map(toCategory);
  },

  /** Subcategories of one category — rendered as icon pills on the category page. */
  async listSubcategories(categoryId: string): Promise<Subcategory[]> {
    const data = await apiRequest<RawSubcategory[]>(
      `/posts/categories/${categoryId}/subcategories`,
    );
    return data.map(toSubcategory);
  },

  async listLatest(limit = 12, offset = 0): Promise<PostSummary[]> {
    const data = await apiRequest<RawPostSummary[]>(`/posts?limit=${limit}&offset=${offset}`);
    return data.map((r) => toPostSummary(r));
  },

  async listByCategory(categoryId: string, kind?: "thread" | "tool"): Promise<PostSummary[]> {
    const query = new URLSearchParams({ category_id: categoryId, limit: "50" });
    if (kind) query.set("kind", kind);
    const data = await apiRequest<RawPostSummary[]>(`/posts?${query.toString()}`);
    return data.map((r) => toPostSummary(r));
  },

  async listBySubcategory(subcategoryId: string): Promise<PostSummary[]> {
    const data = await apiRequest<RawPostSummary[]>(
      `/posts?subcategory_id=${subcategoryId}&limit=50`,
    );
    return data.map((r) => toPostSummary(r));
  },

  async getPost(id: string): Promise<PostDetail> {
    const raw = await apiRequest<RawPostDetail>(`/posts/${id}`);
    return toPostDetail(raw);
  },

  async createPost(input: CreatePostInput): Promise<{ id: string }> {
    return apiRequest<{ id: string }>("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.toApi()),
    });
  },

  async toggleLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
    const data = await apiRequest<{ liked: boolean; like_count: number }>(
      `/posts/${id}/like`,
      { method: "POST" },
    );
    return { liked: data.liked, likeCount: data.like_count };
  },

  async reportPost(id: string, reason: string): Promise<void> {
    await apiRequest(`/posts/${id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },

  async deletePost(id: string): Promise<void> {
    await apiRequest(`/posts/${id}`, { method: "DELETE" });
  },

  async listSimilar(id: string): Promise<PostSummary[]> {
    const data = await apiRequest<RawPostSummary[]>(`/posts/${id}/similar?limit=6`);
    return data.map((r) => toPostSummary(r));
  },

  async listComments(id: string): Promise<PostComment[]> {
    const data = await apiRequest<RawComment[]>(`/posts/${id}/comments?limit=100`);
    return data.map(toComment);
  },

  async addComment(id: string, content: string): Promise<PostComment> {
    const data = await apiRequest<RawComment>(`/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return toComment(data);
  },

  async listByAuthor(username: string): Promise<PostSummary[]> {
    const data = await apiRequest<RawPostSummary[]>(`/posts/author/${encodeURIComponent(username)}?limit=30`);
    return data.map((r) => toPostSummary(r));
  },


  /** Downloads the tool's file after payment; returns the server's filename. */
  async downloadToolFile(id: string): Promise<string | null> {
    const { apiBlob } = await import("@/services/api");
    const { blob, filename } = await apiBlob(`/posts/${id}/file`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  },
};
