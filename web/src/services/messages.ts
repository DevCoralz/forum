import { apiRequest } from "@/services/api";
import {
  toAuthor,
  toChatMessage,
  toThread,
  type RawAuthor,
  type RawChatMessage,
  type RawThread,
} from "@/services/mappers";
import type { AuthorIdentity, ChatMessage, DirectThreadSummary } from "@/types/community";

export const messagesService = {
  listStream: async (before?: string): Promise<ChatMessage[]> => {
    const raw = await apiRequest<RawChatMessage[]>(
      `/chat/stream${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    );
    return raw.map(toChatMessage);
  },

  joinStream: () =>
    apiRequest<{ joined: boolean; member_count?: number }>("/chat/stream/join", { method: "POST" }),

  /**
   * Send a plain text message.
   * The backend expects multipart/form-data — do NOT set Content-Type manually,
   * the browser sets the correct boundary when FormData is the body.
   */
  sendText: async (text: string): Promise<ChatMessage> => {
    const form = new FormData();
    form.append("text", text);
    const raw = await apiRequest<RawChatMessage>("/chat/stream/messages", {
      method: "POST",
      body: form,
    });
    return toChatMessage(raw);
  },

  /** Send an image with an optional text caption. */
  sendImage: async (file: File, caption?: string): Promise<ChatMessage> => {
    const form = new FormData();
    form.append("image", file);
    if (caption) form.append("text", caption);
    const raw = await apiRequest<RawChatMessage>("/chat/stream/messages", {
      method: "POST",
      body: form,
    });
    return toChatMessage(raw);
  },

  listThreads: async (): Promise<DirectThreadSummary[]> => {
    const raw = await apiRequest<RawThread[]>("/dm/threads");
    return raw.map(toThread);
  },

  /** Search users by username prefix/substring. */
  searchUsers: async (q: string): Promise<AuthorIdentity[]> => {
    const raw = await apiRequest<RawAuthor[]>(`/users/search?q=${encodeURIComponent(q)}`);
    return raw.map(toAuthor);
  },

  /** Open or resume a DM thread with another user. */
  startThread: async (username: string): Promise<DirectThreadSummary> => {
    const raw = await apiRequest<RawThread>("/dm/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    return toThread(raw);
  },
};
