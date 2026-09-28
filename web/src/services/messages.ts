import { apiRequest } from "@/services/api";
import {
  type RawChatMessage,
  type RawThread,
  toChatMessage,
  toThread,
} from "@/services/mappers";
import type { ChatMessage, DirectThreadSummary } from "@/types/community";

/**
 * Backs the single public chat stream at /api/v1/chat/stream (see
 * api/app/api/chat/stream.py). There is currently no backend router for
 * per-user direct-message threads — listThreads() is wired to the existing
 * DirectThreadSummary/RawThread shapes in mappers.ts so the UI compiles and
 * renders an empty inbox, but it has no live endpoint to call yet.
 */
export const messagesService = {
  /** Latest public chat messages, oldest first. Pass `before` (a message id) to page further back. */
  async listStream(limit = 80, before?: string): Promise<ChatMessage[]> {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set("before", before);
    const data = await apiRequest<RawChatMessage[]>(`/chat/stream?${query.toString()}`);
    return data.map(toChatMessage);
  },

  /** Marks the current user as present in the stream; returns the live member count. */
  async join(): Promise<{ joined: boolean; memberCount: number }> {
    const data = await apiRequest<{ joined: boolean; member_count: number }>(
      "/chat/stream/join",
      { method: "POST" },
    );
    return { joined: data.joined, memberCount: data.member_count };
  },

  /** Sends a text and/or image message. At least one of the two is required by the server. */
  async send(text?: string, image?: File): Promise<ChatMessage> {
    const form = new FormData();
    if (text?.trim()) form.append("text", text.trim());
    if (image) form.append("image", image);
    const data = await apiRequest<RawChatMessage>("/chat/stream/messages", {
      method: "POST",
      body: form,
    });
    return toChatMessage(data);
  },

  /**
   * Direct-message thread list for the inbox view. No backend route exists
   * for this yet (only the public stream above is implemented server-side),
   * so this currently returns an empty inbox rather than calling a 404.
   * Swap the body below for an apiRequest<RawThread[]>("/messages/threads")
   * call once that endpoint ships.
   */
  async listThreads(): Promise<DirectThreadSummary[]> {
    const data: RawThread[] = [];
    return data.map(toThread);
  },
};
