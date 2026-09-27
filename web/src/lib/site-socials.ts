import { Send, MessageCircle, Globe, Github } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Site-wide social links (admin-set, distinct from a user's own profile
 * socials in SocialLink[]). Storage is an open string->string map on the
 * backend (app/api/admin/site.py: site_socials), so an unknown key here just
 * renders with the generic Globe icon instead of failing. Twitch/Youtube are
 * deprecated in lucide-react as of 0.5xx (still exported, flagged for
 * eventual removal) so they're deliberately left out here — Discord has no
 * dedicated lucide icon either, hence MessageCircle for it, matching the
 * same stand-in already used for Discord in profile-page.tsx.
 */
export const SITE_SOCIAL_PLATFORMS: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "discord", label: "Discord", icon: MessageCircle },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "twitter", label: "Twitter / X", icon: Globe },
  { key: "github", label: "GitHub", icon: Github },
  { key: "website", label: "Website", icon: Globe },
];

export function socialIcon(key: string): ComponentType<{ className?: string }> {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.icon ?? Globe;
}

export function socialLabel(key: string): string {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
