export type AccountTier = "free" | "premium";

export type CommunityRole = "member" | "admin" | "super_admin";

export type ProfileVisibility = "public" | "premium";

export interface SocialLink {
  platform: "discord" | "telegram" | "website";
  value: string;
}

export interface AuthorIdentity {
  id: string;
  username: string;
  avatarUrl?: string;
  initials: string;
  accent: "cyan" | "violet" | "blue" | "emerald";
  verified: boolean;
  tier: AccountTier;
  roles: readonly CommunityRole[];
  labels: readonly string[];
  /** Shimmer tags with their color, from the admin tag catalog. */
  badges?: readonly { name: string; color: string }[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  postCount: number;
  icon: "flame" | "settings" | "crown" | "database" | "cookie" | "file" | "grid";
  tone: "rose" | "cyan" | "violet" | "emerald" | "amber" | "blue";
}

export interface PostSummary {
  id: string;
  title: string;
  excerpt: string;
  category: Category["name"];
  subcategory?: string;
  access: "free" | "premium";
  author: AuthorIdentity;
  publishedAt: string;
  views: string;
  comments: string;
  likes: string;
  isPinned?: boolean;
  protectedContent?: never;
}

export interface PostDetail extends Omit<PostSummary, "protectedContent"> {
  /** Only returned by the server when the viewer is premium or has liked + commented. */
  body?: string;
  /** Why content is hidden: "login" | "premium" | "interact"; undefined when readable. */
  lockReason?: "login" | "premium" | "interact";
  likedByViewer: boolean;
  commentedByViewer: boolean;
}

export interface PostComment {
  id: string;
  author: AuthorIdentity;
  body: string;
  createdAt: string;
}

export interface CommunityProfile extends AuthorIdentity {
  bio: string;
  visibility: ProfileVisibility;
  joinedAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  socials: SocialLink[];
  canPublish: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: ProfileVisibility;
  allowComments: boolean;
  allowMentions: boolean;
  allowDirectMessages: boolean;
}

export interface AccountSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface SubscriptionSummary {
  tier: AccountTier;
  status: "active" | "inactive" | "paused";
  managedBy: "admin";
  renewsAt?: string;
}
export type PostAudience = "only_me" | "public" | "premium";

export type TitleColor = "default" | "blue" | "violet" | "cyan" | "emerald" | "amber" | "rose";

export interface CreatePostInput {
  audience: PostAudience;
  title: string;
  titleColor: TitleColor;
  /** Telegram-style formatted text, stored exactly as typed. */
  body: string;
  categoryId: string;
  subcategory?: string;
}

export interface ChatMessage {
  id: string;
  author: AuthorIdentity;
  text?: string;
  /** Image uploads are premium+ only; the server rejects them from free members. */
  imageUrl?: string;
  createdAt: string;
}

export interface DirectThreadSummary {
  id: string;
  peer: AuthorIdentity;
  lastMessage: string;
  updatedAt: string;
  unread: number;
}
