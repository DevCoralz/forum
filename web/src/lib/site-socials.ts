import { Send, MessageCircle, Globe, Github } from "lucide-react";
import type { ComponentType } from "react";

export const SITE_SOCIAL_PLATFORMS: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "discord",   label: "Discord",      icon: MessageCircle },
  { key: "telegram",  label: "Telegram",     icon: Send },
  { key: "whatsapp",  label: "WhatsApp",     icon: MessageCircle },
  { key: "twitter",   label: "Twitter / X",  icon: Globe },
  { key: "github",    label: "GitHub",       icon: Github },
  { key: "website",   label: "Website",      icon: Globe },
];

export function socialIcon(key: string): ComponentType<{ className?: string }> {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.icon ?? Globe;
}

export function socialLabel(key: string): string {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
