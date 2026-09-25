import { ImagePlus, Lock, MessageCircle, Radio, Search, Send, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthorIdentity } from "@/components/profiles/author-identity";
import { messagesService } from "@/services/messages";
import { ApiError, assetUrl } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import type { AuthorIdentity as AuthorIdentityType, ChatMessage } from "@/types/community";

type Tab = "stream" | "dms";

function clockTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessagesPage() {
  const [tab, setTab] = useState<Tab>("stream");
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Messages</h1>
      </div>
      <div className="mt-4 inline-flex rounded-full border border-border bg-surface/60 p-1" role="tablist">
        {([["stream", "Chat stream", Radio], ["dms", "DMs", MessageCircle]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition ${tab === id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      <div className="mt-5">{tab === "stream" ? <ChatStream /> : <DirectMessages />}</div>
    </section>
  );
}

function ChatStream() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSendImages = user?.tier === "premium";

  const streamQuery = useQuery({
    queryKey: ["chat-stream"],
    queryFn: () => messagesService.listStream(),
    refetchInterval: joined ? 4000 : 8000,
    retry: false,
  });
  const messages: ChatMessage[] = streamQuery.data ?? [];

  const joinMutation = useMutation({
    mutationFn: messagesService.joinStream,
    onSuccess: () => {
      setJoined(true);
      void queryClient.invalidateQueries({ queryKey: ["chat-stream"] });
    },
    onError: (error) => toast.info(error instanceof ApiError && error.status === 401 ? "Log in to join the chat." : "Couldn't join the chat. Try again."),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (file) {
        const message = await messagesService.sendImage(file, text.trim() || undefined);
        return message;
      }
      return messagesService.sendText(text.trim());
    },
    onSuccess: () => {
      setText("");
      setFile(null);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-stream"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) toast.info("Log in to send messages.");
      else if (error instanceof ApiError && error.status === 403) toast.info("Images are for Premium members.");
      else toast.info("Your message could not be sent. Try again.");
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body && !file) return;
    sendMutation.mutate();
  }

  const memberCount = joined ? "you + the room" : "watching";

  return (
    <div className="border-y border-border/70">
      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-cyan" /></span>
          <span className="text-foreground">{streamQuery.isError ? "Reconnecting…" : "Live"}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Users className="size-3.5" />{memberCount}</span>
        </div>
      </div>

      <div ref={listRef} className="h-[55vh] min-h-72 overflow-y-auto border-t border-border/60 py-2" aria-live="polite">
        {streamQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading the chat…</p>}
        {streamQuery.isError && <p className="py-6 text-center text-sm text-muted-foreground">The chat is unavailable right now.</p>}
        {!streamQuery.isLoading && !streamQuery.isError && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-1 border-b border-border/30 px-1 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <AuthorIdentity author={m.author} />
              <span className="shrink-0 text-[11px] text-muted-foreground">{clockTime(m.createdAt)}</span>
            </div>
            {m.text && <p className="whitespace-pre-wrap break-words pl-10 text-sm text-foreground/90">{m.text}</p>}
            {m.imageUrl && <img src={assetUrl(m.imageUrl)} alt="Shared in chat" className="ml-10 max-h-60 max-w-[70%] rounded-lg border border-border object-cover" />}
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 py-3">
        {!joined ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">You're watching the public chat. Join to send messages.</p>
            <Button variant="coralz" size="sm" disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>
              {joinMutation.isPending ? "Joining…" : "Join chat"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {preview && (
              <div className="relative inline-block">
                <img src={preview} alt="Selected upload" className="h-20 rounded-lg border border-border object-cover" />
                <button onClick={() => { setFile(null); setPreview(null); }} aria-label="Remove image" className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-0.5"><X className="size-3" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (canSendImages) {
                    setFile(f);
                    setPreview(URL.createObjectURL(f));
                  } else {
                    toast("Images are for Premium members", { description: "Free members can send text only." });
                  }
                }
                e.target.value = "";
              }} />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full text-muted-foreground"
                aria-label={canSendImages ? "Attach image" : "Images are for Premium members"}
                onClick={() => (canSendImages ? fileRef.current?.click() : toast("Images are for Premium members", { description: "Free members can send text only." }))}
              >
                {canSendImages ? <ImagePlus /> : <Lock />}
              </Button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                maxLength={1000}
                placeholder="Message the chat…"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-surface/70 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <Button variant="coralz" size="icon" className="shrink-0 rounded-full" aria-label="Send" onClick={send} disabled={(!text.trim() && !file) || sendMutation.isPending}><Send /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DirectMessages() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const threadsQuery = useQuery({
    queryKey: ["dm-threads"],
    queryFn: messagesService.listThreads,
    refetchInterval: 10_000,
    retry: false,
  });

  const searchQuery = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => messagesService.searchUsers(debounced),
    enabled: debounced.length >= 2,
  });

  const startMutation = useMutation({
    mutationFn: messagesService.startThread,
    onSuccess: () => {
      setQuery("");
      void queryClient.invalidateQueries({ queryKey: ["dm-threads"] });
      toast.success("Chat created.", { description: "Sending inside DMs will open once the backend supports it." });
    },
    onError: (error) => toast.info(error instanceof ApiError && error.status === 401 ? "Log in to start a chat." : "Couldn't start that chat. Try again."),
  });

  const results: AuthorIdentityType[] = searchQuery.data ?? [];
  const threads = threadsQuery.data ?? [];

  return (
    <div>
      <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface/70 px-4">
        <Search className="size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a member to message…" aria-label="Search members" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </label>

      {debounced.length >= 2 ? (
        <div className="mt-4 border-y border-border/70">
          {searchQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>}
          {searchQuery.isError && <p className="py-6 text-center text-sm text-muted-foreground">Member search is unavailable right now.</p>}
          {!searchQuery.isLoading && !searchQuery.isError && results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>}
          {results.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 border-b border-border/30 py-3 last:border-0">
              <AuthorIdentity author={u} />
              <Button variant="coralzOutline" size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate(u.username)}>Message</Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 border-y border-border/70">
          {threadsQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading your chats…</p>}
          {threadsQuery.isError && <p className="py-6 text-center text-sm text-muted-foreground">Your chats are unavailable right now.</p>}
          {!threadsQuery.isLoading && !threadsQuery.isError && threads.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No chats yet — search for a member to start one.</p>
          )}
          {threads.map((t) => (
            <button key={t.id} onClick={() => toast.info("Chat opens when the backend supports private messaging.")} className="flex w-full items-center gap-3 border-b border-border/30 py-3 text-left last:border-0 hover:bg-surface/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <AuthorIdentity author={t.peer} />
                  <span className="shrink-0 text-[11px] text-muted-foreground">{clockTime(t.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 pl-10">
                  <p className="truncate text-sm text-muted-foreground">{t.lastMessage}</p>
                  {t.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{t.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
