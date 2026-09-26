import { assetUrl, apiRequest } from "@/services/api";
import type {
  AdSlide, AdminUser, AdminUsersPage, AuditEntry, SiteSettings, TagDefinition,
} from "@/types/admin";

export interface UploadedMedia {
  id: string;
  url: string;
  kind: "image" | "video";
}

export const adminService = {
  listUsers(params: { search?: string; role?: string; status?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<AdminUsersPage>(`/admin/users${suffix}`);
  },
  createMember(body: { username: string; email: string; password: string; role: string }) {
    return apiRequest<{ ok: boolean; id: string }>("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  deleteMember(id: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" });
  },
  setTier(id: string, tier: "free" | "premium") {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/tier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
  },
  suspend(id: string, body: { days?: number | null; reason?: string | null }) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  unsuspend(id: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/unsuspend`, { method: "POST" });
  },
  ban(id: string, reason?: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },
  unban(id: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/unban`, { method: "POST" });
  },
  flag(id: string, reason?: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },
  unflag(id: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/unflag`, { method: "POST" });
  },
  setVerifiedTick(id: string, isVerifiedTick: boolean) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/verified-tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_verified_tick: isVerifiedTick }),
    });
  },
  addTag(id: string, name: string, color: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
  },
  removeTag(id: string, name: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/tags?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },
  resetPassword(id: string, password: string) {
    return apiRequest<{ ok: boolean }>(`/admin/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },

  listTags() {
    return apiRequest<{ items: TagDefinition[] }>("/admin/tags");
  },
  upsertTag(name: string, color: string) {
    return apiRequest<{ ok: boolean }>("/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
  },
  deleteTag(name: string) {
    return apiRequest<{ ok: boolean }>(`/admin/tags/${encodeURIComponent(name)}`, { method: "DELETE" });
  },

  getSiteSettings() {
    return apiRequest<SiteSettings>("/admin/site-settings");
  },
  putSiteSettings(values: Record<string, string>) {
    return apiRequest<SiteSettings>("/admin/site-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  },

  listAds() {
    return apiRequest<{ items: AdSlide[] }>("/admin/ads");
  },
  createAd(body: Partial<AdSlide>) {
    return apiRequest<AdSlide>("/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  updateAd(id: string, body: Partial<AdSlide>) {
    return apiRequest<AdSlide>(`/admin/ads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  deleteAd(id: string) {
    return apiRequest<{ ok: boolean }>(`/admin/ads/${id}`, { method: "DELETE" });
  },

  auditLog() {
    return apiRequest<{ items: AuditEntry[] }>("/admin/audit-log");
  },

  /** Uploads go to the server's media storage (Telegram-backed); returns id + url. */
  async uploadMedia(file: File): Promise<UploadedMedia> {
    const form = new FormData();
    form.append("file", file);
    const result = await apiRequest<UploadedMedia>("/media", { method: "POST", body: form });
    return { ...result, url: assetUrl(result.url) ?? result.url };
  },
};
