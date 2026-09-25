import { assetUrl } from "@/services/api";
import type {
  AccountSession,
  AccountTier,
  AuthorIdentity,
  Category,
  ChatMessage,
  CommunityProfile,
  DirectThreadSummary,
  PostComment,
  PostDetail,
  PostSummary,
  PrivacyPreferences,
  SocialLink,
  SubscriptionSummary,
} from "@/types/community";

/* ── raw shapes returned by the FastAPI backend ─────────────────────────── */

export interface RawAuthor {
  id: string;
  username: string;
  avatar_url?: string | null;
  is_verified_tick?: boolean;
  labels?: string[] | null;
  role?: string | null;
  tier?: string | null;
}

export interface RawCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  post_count?: number | null;
}

export interface RawSubcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface RawPostSummary {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_name?: string | null;
  subcategory_id?: string | null;
  subcategory_name?: string | null;
  author: RawAuthor;
  post_type: string;
  is_locked: boolean;
  is_pinned?: boolean | null;
  excerpt?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface RawPostDetail extends RawPostSummary {
  content?: string | null;
  liked_by_viewer?: boolean;
  commented_by_viewer?: boolean;
}

export interface RawComment {
  id: string;
  post_id: string;
  author: RawAuthor;
  content: string;
  created_at: string;
}

export interface RawProfile {
  id: string;
  username: string;
  about_me?: string | null;
  avatar_url?: string | null;
  is_verified_tick?: boolean;
  labels?: string[] | null;
  socials?: Record<string, string> | SocialLink[] | null;
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  created_at: string;
  role?: string | null;
  can_publish?: boolean;
  profile_visibility?: string | null;
}

export interface RawSession {
  id: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
  last_used?: string | null;
  expires_at?: string | null;
  is_current: boolean;
}

export interface RawPrivacy {
  profile_visibility?: string | null;
  allow_comments?: boolean | null;
  allow_mentions?: boolean | null;
  allow_direct_messages?: boolean | null;
  show_email?: boolean | null;
  show_socials?: boolean | null;
  show_activity?: boolean | null;
  allow_follow?: boolean | null;
}

export interface RawSubscription {
  tier?: string | null;
  status?: string | null;
  expires_at?: string | null;
}

export interface RawChatMessage {
  id: string;
  author: RawAuthor;
  text?: string | null;
  image_url?: string | null;
  created_at: string;
}

export interface RawThread {
  id: string;
  peer: RawAuthor;
  last_message?: string | null;
  updated_at: string;
  unread?: number;
}

/* ── helpers ────────────────────────────────────────────────────────────── */

const ACCENTS = ["cyan", "violet", "blue", "emerald"] as const;
const TONES = ["rose", "cyan", "violet", "emerald", "amber", "blue"] as const;

function pick<T>(list: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return list[hash % list.length]!;
}

export function initialsOf(username: string): string {
  const parts = username.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function tierOf(role?: string | null): AccountTier {
  return role === "premium" || role === "admin" || role === "super_admin" ? "premium" : "free";
}

export function timeAgo(iso: string): string {
  const then = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function clockTime(iso: string): string {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function compact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function categoryIcon(slug: string, icon?: string | null): Category["icon"] {
  const allowed = ["flame", "settings", "crown", "database", "cookie", "file", "grid"] as const;
  if (icon && (allowed as readonly string[]).includes(icon)) return icon as Category["icon"];
  const bySlug: Record<string, Category["icon"]> = {
    leaks: "flame",
    methods: "settings",
    premium: "crown",
    "combos-accounts": "database",
    cookies: "cookie",
    logs: "file",
    others: "grid",
  };
  return bySlug[slug] ?? "grid";
}

/* ── mappers ────────────────────────────────────────────────────────────── */

export function toAuthor(raw: RawAuthor): AuthorIdentity {
  const role = raw.role ?? raw.tier ?? null;
  const author: AuthorIdentity = {
    id: raw.id,
    username: raw.username,
    initials: initialsOf(raw.username),
    accent: pick(ACCENTS, raw.id || raw.username),
    verified: Boolean(raw.is_verified_tick),
    tier: tierOf(role),
    roles: role === "admin" || role === "super_admin" ? [role === "admin" ? "admin" : "super_admin"] : ["member"],
    labels: raw.labels ?? [],
  };
  const avatar = assetUrl(raw.avatar_url);
  return avatar ? { ...author, avatarUrl: avatar } : author;
}

export function toCategory(raw: RawCategory): Category {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    postCount: raw.post_count ?? 0,
    icon: categoryIcon(raw.slug, raw.icon),
    tone: pick(TONES, raw.slug),
  };
}

export function toPostSummary(
  raw: RawPostSummary,
  categoryNames: Map<string, string> = new Map(),
): PostSummary {
  const summary: PostSummary = {
    id: raw.id,
    title: raw.title,
    excerpt: raw.excerpt ?? "",
    category: raw.category_name ?? categoryNames.get(raw.category_id) ?? "General",
    access: raw.post_type === "premium" ? "premium" : "free",
    author: toAuthor(raw.author),
    publishedAt: timeAgo(raw.created_at),
    views: compact(raw.view_count ?? 0),
    comments: compact(raw.comment_count ?? 0),
    likes: compact(raw.like_count ?? 0),
  };
  if (raw.subcategory_name) summary.subcategory = raw.subcategory_name;
  if (raw.is_pinned) summary.isPinned = true;
  return summary;
}

export function toPostDetail(
  raw: RawPostDetail,
  categoryNames: Map<string, string> = new Map(),
): PostDetail {
  const base = toPostSummary(raw, categoryNames);
  const detail: PostDetail = {
    ...base,
    likedByViewer: Boolean(raw.liked_by_viewer),
    commentedByViewer: Boolean(raw.commented_by_viewer),
  };
  if (raw.content) detail.body = raw.content;
  return detail;
}

export function toComment(raw: RawComment): PostComment {
  return {
    id: raw.id,
    author: toAuthor(raw.author),
    body: raw.content,
    createdAt: timeAgo(raw.created_at),
  };
}

function toSocials(value: RawProfile["socials"]): SocialLink[] {
  const platforms: SocialLink["platform"][] = ["discord", "telegram", "website"];
  if (Array.isArray(value)) {
    return value.filter((item): item is SocialLink => platforms.includes(item.platform));
  }
  const record = value ?? {};
  return platforms.map((platform) => ({ platform, value: record[platform] ?? "" }));
}

export function toProfile(raw: RawProfile): CommunityProfile {
  return {
    ...toAuthor(raw),
    bio: raw.about_me ?? "",
    visibility: raw.profile_visibility === "premium" ? "premium" : "public",
    joinedAt: new Date(raw.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    followerCount: raw.follower_count ?? 0,
    followingCount: raw.following_count ?? 0,
    postCount: raw.post_count ?? 0,
    socials: toSocials(raw.socials),
    canPublish: raw.can_publish ?? tierOf(raw.role) === "premium",
  };
}

export function toSession(raw: RawSession): AccountSession {
  const agent = raw.user_agent ?? "";
  const browser = /edg/i.test(agent) ? "Edge" : /chrome/i.test(agent) ? "Chrome" : /safari/i.test(agent) ? "Safari" : /firefox/i.test(agent) ? "Firefox" : "Browser";
  const os = /iphone|ipad/i.test(agent) ? "iOS" : /android/i.test(agent) ? "Android" : /mac/i.test(agent) ? "macOS" : /windows/i.test(agent) ? "Windows" : "device";
  return {
    id: raw.id,
    device: `${browser} on ${os}`,
    location: raw.ip_address ?? "Unknown location",
    lastActive: raw.last_used ? timeAgo(raw.last_used) : timeAgo(raw.created_at),
    current: raw.is_current,
  };
}

export function toPrivacy(raw: RawPrivacy): PrivacyPreferences {
  return {
    profileVisibility: raw.profile_visibility === "premium" ? "premium" : "public",
    allowComments: raw.allow_comments ?? true,
    allowMentions: raw.allow_mentions ?? true,
    allowDirectMessages: raw.allow_direct_messages ?? raw.allow_follow ?? true,
  };
}

export function fromPrivacy(value: PrivacyPreferences) {
  return {
    profile_visibility: value.profileVisibility,
    allow_comments: value.allowComments,
    allow_mentions: value.allowMentions,
    allow_direct_messages: value.allowDirectMessages,
  };
}

export function toSubscription(raw: RawSubscription): SubscriptionSummary {
  const summary: SubscriptionSummary = {
    tier: raw.tier === "premium" ? "premium" : "free",
    status: raw.status === "active" ? "active" : raw.status === "paused" ? "paused" : "inactive",
    managedBy: "admin",
  };
  if (raw.expires_at) {
    summary.renewsAt = new Date(raw.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  return summary;
}

export function toChatMessage(raw: RawChatMessage): ChatMessage {
  const message: ChatMessage = {
    id: raw.id,
    author: toAuthor(raw.author),
    createdAt: clockTime(raw.created_at),
  };
  if (raw.text) message.text = raw.text;
  const image = assetUrl(raw.image_url);
  if (image) message.imageUrl = image;
  return message;
}

export function toThread(raw: RawThread): DirectThreadSummary {
  return {
    id: raw.id,
    peer: toAuthor(raw.peer),
    lastMessage: raw.last_message ?? "",
    updatedAt: timeAgo(raw.updated_at),
    unread: raw.unread ?? 0,
  };
}
