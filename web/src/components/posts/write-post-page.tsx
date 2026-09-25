import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bold, Check, ChevronDown, Code, Crown, EyeOff, Globe, Italic, Link2, LockKeyhole, Quote,
  SquareCode, Strikethrough, Underline, Sparkles, Trash2, Send,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormattedText, FORMAT_MARKERS, type FormatKind } from "@/lib/telegram-format";
import { postsService } from "@/services/posts";
import { ApiError } from "@/services/api";
import type { Category, PostAudience, TitleColor } from "@/types/community";

const TITLE_MAX = 140;
const BODY_MAX = 20000;
const DRAFT_KEY = "coralz:write-draft";

const audiences: { value: PostAudience; label: string; hint: string; icon: typeof Globe }[] = [
  { value: "public", label: "Public", hint: "Everyone can see it", icon: Globe },
  { value: "premium", label: "Premium users", hint: "Only premium members", icon: Crown },
  { value: "only_me", label: "Only me", hint: "Private, just for you", icon: LockKeyhole },
];

export const titleColors: Record<TitleColor, { label: string; className: string; swatch: string }> = {
  default: { label: "Default", className: "text-foreground", swatch: "bg-foreground" },
  blue: { label: "Royal blue", className: "text-primary", swatch: "bg-primary" },
  violet: { label: "Violet", className: "text-[oklch(0.72_0.2_300)]", swatch: "bg-[oklch(0.72_0.2_300)]" },
  cyan: { label: "Cyan", className: "text-[oklch(0.8_0.13_210)]", swatch: "bg-[oklch(0.8_0.13_210)]" },
  emerald: { label: "Emerald", className: "text-[oklch(0.78_0.15_160)]", swatch: "bg-[oklch(0.78_0.15_160)]" },
  amber: { label: "Amber", className: "text-[oklch(0.82_0.14_80)]", swatch: "bg-[oklch(0.82_0.14_80)]" },
  rose: { label: "Rose", className: "text-[oklch(0.72_0.19_15)]", swatch: "bg-[oklch(0.72_0.19_15)]" },
};

const schema = z.object({
  audience: z.enum(["only_me", "public", "premium"]),
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(TITLE_MAX),
  titleColor: z.enum(["default", "blue", "violet", "cyan", "emerald", "amber", "rose"]),
  body: z.string().refine((v) => v.trim().length >= 10, "Post content needs at least 10 characters").refine((v) => v.length <= BODY_MAX, "Post is too long"),
  categoryId: z.string().min(1, "Choose a category"),
  subcategory: z.string().trim().max(40).optional(),
});

type Draft = z.infer<typeof schema>;
const emptyDraft: Draft = { audience: "public", title: "", titleColor: "default", body: "", categoryId: "", subcategory: "" };

const tools: { kind: FormatKind; label: string; icon: typeof Bold; shortcut?: string }[] = [
  { kind: "bold", label: "Bold", icon: Bold, shortcut: "Ctrl+B" },
  { kind: "italic", label: "Italic", icon: Italic, shortcut: "Ctrl+I" },
  { kind: "underline", label: "Underline", icon: Underline, shortcut: "Ctrl+U" },
  { kind: "strike", label: "Strikethrough", icon: Strikethrough, shortcut: "Ctrl+Shift+X" },
  { kind: "spoiler", label: "Spoiler", icon: EyeOff, shortcut: "Ctrl+Shift+P" },
  { kind: "code", label: "Monospace", icon: Code, shortcut: "Ctrl+Shift+M" },
  { kind: "pre", label: "Code block", icon: SquareCode },
  { kind: "quote", label: "Quote", icon: Quote },
  { kind: "link", label: "Create link", icon: Link2, shortcut: "Ctrl+K" },
];

function applyFormat(el: HTMLTextAreaElement | HTMLInputElement, value: string, kind: FormatKind) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const sel = value.slice(start, end);
  let insert: string;
  let cursorStart: number;
  let cursorEnd: number;
  if (kind === "link") {
    const url = window.prompt("Link URL (https://…)", "https://");
    if (!url) return null;
    const text = sel || "link text";
    insert = `[${text}](${url.trim()})`;
    cursorStart = start + 1;
    cursorEnd = cursorStart + text.length;
  } else if (kind === "quote") {
    const text = (sel || "quote").split("\n").map((l) => `> ${l}`).join("\n");
    insert = text;
    cursorStart = start;
    cursorEnd = start + text.length;
  } else if (kind === "pre") {
    const text = sel || "code";
    insert = "```\n" + text + "\n```";
    cursorStart = start + 4;
    cursorEnd = cursorStart + text.length;
  } else {
    const m = FORMAT_MARKERS[kind];
    const text = sel || kind;
    insert = `${m}${text}${m}`;
    cursorStart = start + m.length;
    cursorEnd = cursorStart + text.length;
  }
  return { next: value.slice(0, start) + insert + value.slice(end), cursorStart, cursorEnd };
}

function shortcutKind(e: KeyboardEvent): FormatKind | null {
  if (!(e.ctrlKey || e.metaKey)) return null;
  const k = e.key.toLowerCase();
  if (e.shiftKey) return k === "x" ? "strike" : k === "p" ? "spoiler" : k === "m" ? "code" : null;
  return k === "b" ? "bold" : k === "i" ? "italic" : k === "u" ? "underline" : k === "k" ? "link" : null;
}

export function WritePostPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [focused, setFocused] = useState<"title" | "body">("body");
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: postsService.listCategories,
    staleTime: 60_000,
  });
  const categories: Category[] = categoriesQuery.data ?? [];

  // Restore an unfinished draft saved on this device.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) { const saved = schema.partial().parse(JSON.parse(raw)); setDraft((d) => { const n = { ...d }; for (const [k, v] of Object.entries(saved)) if (v !== undefined) (n as Record<string, unknown>)[k] = v; return n; }); }
    } catch { /* ignore broken drafts */ }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => clearTimeout(t);
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const format = (kind: FormatKind, target: "title" | "body" = focused) => {
    const ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null> = target === "title" ? titleRef : bodyRef;
    const el = ref.current;
    if (!el) return;
    if (target === "title" && (kind === "pre" || kind === "quote")) return;
    const result = applyFormat(el, draft[target], kind);
    if (!result) return;
    set(target, result.next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(result.cursorStart, result.cursorEnd); });
  };

  const onKey = (target: "title" | "body") => (e: KeyboardEvent) => {
    const kind = shortcutKind(e);
    if (kind) { e.preventDefault(); format(kind, target); }
  };

  const publish = async () => {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Draft] ||= issue.message;
      setErrors(next);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setPublishing(true);
    try {
      const { subcategory, ...rest } = parsed.data;
      const created = await postsService.createPost(subcategory ? { ...rest, subcategory } : rest);
      localStorage.removeItem(DRAFT_KEY);
      setDraft(emptyDraft);
      toast.success("Post published");
      navigate({ to: "/post/$postId", params: { postId: created.id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) toast.error("Log in before publishing.");
      else if (err instanceof ApiError && err.status === 403) toast.error("Your account isn't allowed to post yet.");
      else toast.error("Couldn't publish. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const clear = () => { if (window.confirm("Discard this draft?")) { setDraft(emptyDraft); localStorage.removeItem(DRAFT_KEY); } };

  const audience = audiences.find((a) => a.value === draft.audience)!;
  const color = titleColors[draft.titleColor];
  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
  const category = categories.find((c) => c.id === draft.categoryId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Write a post</h1>
          <p className="mt-1 text-xs text-muted-foreground">{savedAt ? `Draft saved on this device · ${savedAt}` : "Drafts save automatically on this device"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/40 bg-surface/50 px-4 text-sm text-foreground hover:bg-primary/10" aria-label="Who can see this post">
              <audience.icon className="size-4 text-primary" />{audience.label}<ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {audiences.map((a) => (
              <DropdownMenuItem key={a.value} onSelect={() => set("audience", a.value)} className="gap-3">
                <a.icon className="size-4 text-primary" />
                <span className="flex-1"><span className="block text-sm">{a.label}</span><span className="block text-xs text-muted-foreground">{a.hint}</span></span>
                {a.value === draft.audience && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-8 space-y-6">
        {/* Title + color */}
        <section>
          <label htmlFor="post-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Title / description</label>
          <div className="mt-2 flex items-center gap-2 border-b border-border focus-within:border-primary">
            <input
              id="post-title" ref={titleRef} value={draft.title} maxLength={TITLE_MAX}
              onChange={(e) => set("title", e.target.value)} onFocus={() => setFocused("title")} onKeyDown={onKey("title")}
              placeholder="What's this post about?"
              className={`min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground ${color.className}`}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/50 px-2.5 text-xs text-muted-foreground hover:text-foreground" aria-label="Title color">
                  <span className={`size-3.5 rounded-full ${color.swatch}`} /><span className="hidden sm:inline">{color.label}</span><ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(titleColors) as TitleColor[]).map((c) => (
                  <DropdownMenuItem key={c} onSelect={() => set("titleColor", c)} className="gap-2">
                    <span className={`size-3.5 rounded-full ${titleColors[c].swatch}`} />{titleColors[c].label}
                    {c === draft.titleColor && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-destructive">{errors.title}</span><span className="text-muted-foreground">{draft.title.length}/{TITLE_MAX}</span></div>
        </section>

        {/* Body */}
        <section>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Post content</span>

          <div className="mt-2 rounded-2xl border border-border bg-surface/30 focus-within:border-primary/60">
            <div className="scrollbar-none flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5" role="toolbar" aria-label="Text formatting">
              {tools.map((t) => (
                <button
                  key={t.kind} type="button"
                  onMouseDown={(e) => e.preventDefault()} onClick={() => format(t.kind)}
                  title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label} aria-label={t.label}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40"
                ><t.icon className="size-4" /></button>
              ))}
              <span className="ml-auto hidden shrink-0 pl-2 text-[11px] text-muted-foreground sm:inline">Applies to {focused === "title" ? "title" : "content"}</span>
            </div>
            <div className="grid lg:grid-cols-2">
              <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
                <p className="border-b border-border px-4 py-2 text-[11px] font-medium uppercase text-muted-foreground">Writing</p>
                <textarea
                  ref={bodyRef} value={draft.body} maxLength={BODY_MAX}
                  onChange={(e) => set("body", e.target.value)} onFocus={() => setFocused("body")} onKeyDown={onKey("body")}
                  placeholder={"Write your post. Blank lines are preserved.\n\nSelect text and use the toolbar, or Ctrl+B / Ctrl+I / Ctrl+U."}
                  className="block min-h-72 w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-7 text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
                />
              </div>
              <div className="min-h-72 min-w-0 px-4 py-4" aria-live="polite" aria-label="Live formatted preview">
                <p className="mb-3 text-[11px] font-medium uppercase text-muted-foreground">Live preview</p>
                {draft.body.trim()
                  ? <FormattedText text={draft.body} className="text-sm leading-7 text-foreground/90" />
                  : <p className="text-sm text-muted-foreground">Your formatted post will appear here as you write.</p>}
              </div>
            </div>
          </div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-destructive">{errors.body}</span><span className="text-muted-foreground">{words} words · {draft.body.length}/{BODY_MAX}</span></div>
        </section>

        {/* Category */}
        <section>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</span>
          <div className="scrollbar-none mt-2 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id} type="button" onClick={() => set("categoryId", c.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${draft.categoryId === c.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"}`}
              >{c.name}</button>
            ))}
          </div>
          {category && (
            <input
              value={draft.subcategory ?? ""} maxLength={40} onChange={(e) => set("subcategory", e.target.value)}
              placeholder={`Subcategory in ${category.name} (optional — new ones are created on the spot)`}
              className="mt-3 w-full border-b border-border bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          )}
          {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId}</p>}
        </section>

        {/* Live card preview */}
        {(draft.title || draft.body) && (
          <section className="border-t border-border pt-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Sparkles className="size-3.5 text-primary" />How it will look in the feed</p>
            <div className={`mt-2 font-semibold ${color.className}`}>
              {draft.title ? <FormattedText text={draft.title} /> : "Untitled post"}
            </div>
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {draft.body ? <FormattedText text={draft.body} /> : "Post content preview"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{category?.name ?? "No category"}{draft.subcategory ? ` · ${draft.subcategory}` : ""} · {audience.label}</p>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground"><Trash2 />Discard</Button>
          <Button variant="coralz" onClick={publish} disabled={publishing}><Send />{publishing ? "Posting…" : "Post"}</Button>
        </div>
      </div>
    </div>
  );
}
