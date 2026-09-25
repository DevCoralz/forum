import { apiRequest } from "@/services/api";
import {
  fromPrivacy,
  toPrivacy,
  toProfile,
  toSession,
  toSubscription,
  type RawPrivacy,
  type RawProfile,
  type RawSession,
  type RawSubscription,
} from "@/services/mappers";
import type {
  AccountSession,
  CommunityProfile,
  PrivacyPreferences,
  SubscriptionSummary,
} from "@/types/community";

export type ProfileUpdate = Pick<CommunityProfile, "username" | "bio" | "socials">;

export const profilesService = {
  getByUsername: async (username: string): Promise<CommunityProfile> => {
    const raw = await apiRequest<RawProfile>(`/profiles/${encodeURIComponent(username)}`);
    return toProfile(raw);
  },

  /** Update profile fields including username. Backend: PATCH /me/profile */
  updateMine: (profile: ProfileUpdate) =>
    apiRequest<{ ok: boolean; username?: string }>("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: profile.username,
        about_me: profile.bio,
        socials: profile.socials.map((s) => ({ platform: s.platform, value: s.value })),
      }),
    }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ url: string; id: string }>("/me/avatar", {
      method: "POST",
      body: form,
    });
  },

  /**
   * GET /me/privacy — returns all privacy fields including the extended ones
   * (allow_comments, allow_mentions, allow_direct_messages, profile_visibility).
   */
  getPrivacy: async (): Promise<PrivacyPreferences> => {
    const raw = await apiRequest<RawPrivacy>("/me/privacy");
    return toPrivacy(raw);
  },

  /**
   * PATCH /me/privacy — updates any subset of privacy fields.
   * The merged backend handles all 8 fields in one endpoint.
   */
  updatePrivacy: async (preferences: PrivacyPreferences): Promise<PrivacyPreferences> => {
    const raw = await apiRequest<RawPrivacy>("/me/privacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromPrivacy(preferences)),
    });
    return toPrivacy(raw);
  },

  /** GET /me/sessions */
  listSessions: async (): Promise<AccountSession[]> => {
    const raw = await apiRequest<RawSession[]>("/me/sessions");
    return raw.map(toSession);
  },

  /** DELETE /me/sessions/{id} */
  revokeSession: (sessionId: string) =>
    apiRequest<void>(`/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),

  /** GET /me/subscription */
  getSubscription: async (): Promise<SubscriptionSummary> => {
    const raw = await apiRequest<RawSubscription>("/me/subscription");
    return toSubscription(raw);
  },

  /** POST /auth/change-password */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  /** POST /users/{username}/follow — toggles follow state, returns new state. */
  toggleFollow: (username: string) =>
    apiRequest<{ following: boolean; follower_count: number }>(
      `/users/${encodeURIComponent(username)}/follow`,
      { method: "POST" },
    ),
};
