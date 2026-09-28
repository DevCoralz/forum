import type { ComponentType } from "react";
import { WhatsAppIcon, TelegramIcon } from "@/components/icons/social-icons";

export const SITE_SOCIAL_PLATFORMS: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
  { key: "telegram", label: "Telegram", icon: TelegramIcon },
];

export function socialIcon(key: string): ComponentType<{ className?: string }> {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.icon ?? TelegramIcon;
}

export function socialLabel(key: string): string {
  return SITE_SOCIAL_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
