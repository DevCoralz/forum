export interface AdminUserTag {
  name: string;
  color: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: "free" | "premium" | "admin" | "super_admin";
  is_verified_tick: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  suspend_reason: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
  tags: AdminUserTag[];
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
}

export interface TagDefinition {
  name: string;
  color: string;
}

export interface AdSlide {
  id: string;
  media_id: string | null;
  media_type: "image" | "video";
  description: string;
  url: string | null;
  sort_order: number;
  is_active: boolean;
  media_url?: string | null;
}

export interface SiteSettings {
  site_name?: string;
  site_currency?: string;
  site_footer?: string;
  site_description?: string;
  site_keywords?: string;
  site_mode?: string;
  site_logo_media_id?: string;
  site_favicon_media_id?: string;
  site_og_media_id?: string;
  og_title?: string;
  og_description?: string;
  registration_open?: string;
  site_logo_url?: string | null;
  site_favicon_url?: string | null;
  site_og_url?: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
  actor_username: string | null;
}
