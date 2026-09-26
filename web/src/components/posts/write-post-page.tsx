import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bold, Check, ChevronDown, Code, Crown, EyeOff, Globe, Italic, Link2, LockKeyhole, Quote,
  SquareCode, Strikethrough, Underline, Trash2, Send, ImagePlus, Paperclip, X, Loader2,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { FormattedText, FORMAT_MARKERS, type FormatKind } from "@/lib/telegram-format";
import { postsService, CreatePostInput } from "@/services/posts";
import { adminService } from "@/services/admin";
import { ApiError } from "@/services/api";
import { useSite } from "@/hooks/use-site";
import type { Category, PostAudience, Subcategory, TitleColor } from "@/types/community";

const TITLE_MAX = 140;
const BODY_MAX = 20000;
const DRAFT_KEY = "coralz:write-draft";
const MAX_IMAGES = 8;

type Tab = "thread" | "tool";

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

const threadSchema = z.object({
  audience: z.enum(["only_me", "public", "premium"]),
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(TITLE_MAX),
  titleColor: z.enum(["default", "blue", "violet", "cyan", "emerald", "amber", "rose"]),
  body: z.string().refine((v) => v.trim().length >= 10, "Thread content needs at least 10 characters").refine((v) => v.length <= BODY_MAX, "Thread is too long"),
});

const toolSchema = z.object({
  title: z.string().trim().min(3, "Name needs at least 3 characters").max(TITLE_MAX),
  body: z.string().refine((v) => v.trim().length >= 10, "Description needs at least 10 characters").refine((v) => v.length <= BODY_MAX, "Description is too long"),
  categoryId: z.string().min(1, "Choose a category"),
  price: z.number().min(0, "Price can't be negative").max(1_000_000),
  subcategoryIds: z.array(z.string()).min(1, "Choose at least one subcategory"),
});

type ThreadDraft = z.infer<typeof threadSchema>;
type ToolDraft = {
  title: string;
  body: string;
  categoryId: string;
  price: string;
  subcategoryIds: string[];
};

const emptyThreadDraft: ThreadDraft = { audience: "public", title: "", titleColor: "default", body: "" };
const emptyToolDraft: ToolDraft = { title: "", body: "", categoryId: "", price: "0", subcategoryIds: [] };

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

function applyFormat(el: HTMLTextAreaElement | HTMLInputElement, value: string, kind: FormatKind, linkUrl?: string) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const sel = value.slice(start, end);
  let insert: string;
  let cursorStart: number;
  let cursorEnd: number;
  if (kind === "link") {
    const url = linkUrl?.trim();
    if (!url) return null;
    const text = sel || "link text";
    insert = `[${text}](${url})`;
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
  const { settings } = useSite();
  const currency = settings.site_currency?.trim() || "USD";
  const [tab, setTab] = useState<Tab>("thread");

  // ── Thread state ────────────────────────────────────────────────────────────
  const [thread, setThread] = useState<ThreadDraft>(emptyThreadDraft);
  const [threadImages, setThreadImages] = useState<{ id: string; url: string }[]>([]);
  const [threadFile, setThreadFile] = useState<{ id: string; name: string } | null>(null);

  // ── Tool state ──────────────────────────────────────────────────────────────
  const [tool, setTool] = useState<ToolDraft>(emptyToolDraft);
  const [toolFile, setToolFile] = useState<{ id: string; name: string; size?: number } | null>(null);

  const [focused, setFocused] = useState<"title" | "body">("body");
  const [errors, setErrors] = useState<Partial<Record<"title" | "body" | "categoryId" | "price" | "file" | "subcategoryIds", string>>>({});
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<"title" | "body">("body");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const threadFileInputRef = useRef<HTMLInputElement>(null);
  const toolFileInputRef = useRef<HTMLInputElement>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: postsService.listCategories,
    staleTime: 60_000,
  });
  const allCategories: Category[] = categoriesQuery.data ?? [];
  const toolCategories = allCategories.filter((c) => c.slug !== "threads");

  const subsQuery = useQuery({
    queryKey: ["subcategories", tool.categoryId],
    queryFn: () => postsService.listSubcategories(tool.categoryId),
    enabled: tab === "tool" && Boolean(tool.categoryId),
    staleTime: 60_000,
  });
  const subcategories: Subcategory[] = subsQuery.data ?? [];

  // Restore an unfinished draft saved on this device.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { tab?: Tab; thread?: Partial<ThreadDraft>; tool?: Partial<ToolDraft> };
        if (saved.tab === "tool" || saved.tab === "thread") setTab(saved.tab);
        if (saved.thread) setThread((d) => ({ ...d, ...saved.thread }));
        if (saved.tool) setTool((d) => ({ ...d, ...saved.tool, price: saved.tool?.price ?? "0", subcategoryIds: saved.tool?.subcategoryIds ?? [] }));
      }
    } catch { /* ignore broken drafts */ }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ tab, thread, tool }));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => clearTimeout(t);
  }, [tab, thread, tool]);

  const setThreadField = <K extends keyof ThreadDraft>(key: K, value: ThreadDraft[K]) => {
    setThread((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setToolField = <K extends keyof ToolDraft>(key: K, value: ToolDraft[K]) => {
    setTool((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const current = tab === "thread" ? thread : tool;
  const set = (key: "title" | "body", value: string) => {
    if (tab === "thread") setThreadField(key, value);
    else setToolField(key, value);
  };

  const format = (kind: FormatKind, target: "title" | "body" = focused) => {
    if (kind === "link") { setLinkTarget(target); setLinkOpen(true); return; }
    const ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null> = target === "title" ? titleRef : bodyRef;
    const el = ref.current;
    if (!el) return;
    if (target === "title" && (kind === "pre" || kind === "quote")) return;
    const result = applyFormat(el, current[target] as string, kind);
    if (!result) return;
    set(target, result.next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(result.cursorStart, result.cursorEnd); });
  };

  const applyLink = (url: string) => {
    const el = (linkTarget === "title" ? titleRef : bodyRef).current;
    if (!el) return;
    const result = applyFormat(el, current[linkTarget] as string, "link", url);
    if (!result) return;
    set(linkTarget, result.next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(result.cursorStart, result.cursorEnd); });
  };

  const onKey = (target: "title" | "body") => (e: KeyboardEvent) => {
    const kind = shortcutKind(e);
    if (kind) { e.preventDefault(); format(kind, target); }
  };

  // ── Uploads ─────────────────────────────────────────────────────────────────
  const uploadOne = async (file: File): Promise<{ id: string; url: string; name: string; size?: number } | null> => {
    try {
      const media = await adminService.uploadMedia(file);
      return { id: media.id, url: media.url, name: file.name, size: file.size };
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
      return null;
    }
  };

  const onPickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - threadImages.length;
    if (room <= 0) { toast.error(`Up to ${MAX_IMAGES} images per thread`); return; }
    setUploadingImage(true);
    for (const file of Array.from(files).slice(0, room)) {
      const uploaded = await uploadOne(file);
      if (uploaded) setThreadImages((list) => [...list, { id: uploaded.id, url: uploaded.url }]);
    }
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const onPickThreadFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const uploaded = await uploadOne(file);
    if (uploaded) setThreadFile({ id: uploaded.id, name: uploaded.name });
    setUploadingFile(false);
    if (threadFileInputRef.current) threadFileInputRef.current.value = "";
  };

  const onPickToolFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const uploaded = await uploadOne(file);
    if (uploaded) setToolFile({ id: uploaded.id, name: uploaded.name, ...(uploaded.size !== undefined ? { size: uploaded.size } : {}) });
    setUploadingFile(false);
    if (toolFileInputRef.current) toolFileInputRef.current.value = "";
  };

  // ── Publish ─────────────────────────────────────────────────────────────────
  const publish = async () => {
    setErrors({});
    try {
      if (tab === "thread") {
        const parsed = threadSchema.safeParse(thread);
        if (!parsed.success) throw parsed.error;
        const postType = parsed.data.audience === "premium" ? "premium" : "free";
        setPublishing(true);
        const created = await postsService.createPost(
          new CreatePostInput(parsed.data.title, parsed.data.body, "thread", postType, undefined, [], undefined, undefined, threadFile?.id, threadImages.map((i) => i.id)),
        );
        finish(created.id, "/thread/$threadId", "Thread published");
      } else {
        const priceNumber = Number(tool.price.trim() || "0");
        const parsed = toolSchema.safeParse({
          title: tool.title,
          body: tool.body,
          categoryId: tool.categoryId,
          price: Number.isFinite(priceNumber) ? priceNumber : -1,
          subcategoryIds: tool.subcategoryIds,
        });
        if (!parsed.success) throw parsed.error;
        if (!toolFile) {
          setErrors({ file: "Choose the file buyers will receive" });
          toast.error("Choose the file buyers will receive");
          return;
        }
        setPublishing(true);
        const created = await postsService.createPost(
          new CreatePostInput(parsed.data.title, parsed.data.body, "tool", "free", parsed.data.categoryId, parsed.data.subcategoryIds, parsed.data.price, toolFile.id),
        );
        finish(created.id, "/tool/$toolId", "Tool published");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const next: Record<string, string> = {};
        for (const issue of err.issues) next[String(issue.path[0] ?? "form")] ||= issue.message;
        setErrors(next);
        toast.error("Please fix the highlighted fields");
      } else if (err instanceof ApiError) {
        if (err.status === 401) toast.error("Log in before publishing.");
        else if (err.status === 403) toast.error("Your account isn't allowed to publish yet.");
        else toast.error(err.message || "Couldn't publish. Try again.");
      } else {
        toast.error("Couldn't publish. Try again.");
      }
    } finally {
      setPublishing(false);
    }
  };

  const finish = (id: string, to: "/thread/$threadId" | "/tool/$toolId", message: string) => {
    localStorage.removeItem(DRAFT_KEY);
    setThread(emptyThreadDraft);
    setTool(emptyToolDraft);
    setThreadImages([]);
    setThreadFile(null);
    setToolFile(null);
    toast.success(message);
    navigate({ to, params: tab === "thread" ? { threadId: id } : { toolId: id } });
  };

  const clear = () => setDiscardOpen(true);
  const discard = () => {
    if (tab === "thread") setThread(emptyThreadDraft); else setTool(emptyToolDraft);
    setThreadImages([]); setThreadFile(null); setToolFile(null);
    localStorage.removeItem(DRAFT_KEY);
    setDiscardOpen(false);
    toast.success("Draft discarded");
  };

  const audience = audiences.find((a) => a.value === thread.audience)!;
  const color = titleColors[thread.titleColor];
  const body = current.body;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const titleValue = current.title;
  const setTitle = (value: string) => {
    if (tab === "thread") setThreadField("title", value); else setToolField("title", value);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Write a post</h1>
          <p className="mt-1 text-xs text-muted-foreground">{savedAt ? `Draft saved on this device · ${savedAt}` : "Drafts save automatically on this device"}</p>
        </div>
        {tab === "thread" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/40 bg-surface/50 px-4 text-sm text-foreground hover:bg-primary/10" aria-label="Who can see this thread">
                <audience.icon className="size-4 text-primary" />{audience.label}<ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {audiences.map((a) => (
                <DropdownMenuItem key={a.value} onSelect={() => setThreadField("audience", a.value)} className="gap-3">
                  <a.icon className="size-4 text-primary" />
                  <span className="flex-1"><span className="block text-sm">{a.label}</span><span className="block text-xs text-muted-foreground">{a.hint}</span></span>
                  {a.value === thread.audience && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Threads / Tools tabs */}
      <div className="write-tabs mt-6" role="tablist" aria-label="Post type">
        <button type="button" role="tab" aria-selected={tab === "thread"} className={`write-tab ${tab === "thread" ? "is-active" : ""}`} onClick={() => setTab("thread")}>Thread</button>
        <button type="button" role="tab" aria-selected={tab === "tool"} className={`write-tab ${tab === "tool" ? "is-active" : ""}`} onClick={() => setTab("tool")}>Tool</button>
      </div>

      <div className="mt-8 space-y-6">
        {/* Title */}
        <section>
          <label htmlFor="post-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{tab === "thread" ? "Title" : "Tool name"}</label>
          <div className="mt-2 flex items-center gap-2 border-b border-border focus-within:border-primary">
            <input
              id="post-title" ref={titleRef} value={titleValue} maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)} onFocus={() => setFocused("title")} onKeyDown={onKey("title")}
              placeholder={tab === "thread" ? "What's this thread about?" : "Name your tool"}
              className={`min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground ${tab === "thread" ? color.className : "text-foreground"}`}
            />
            {tab === "thread" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/50 px-2.5 text-xs text-muted-foreground hover:text-foreground" aria-label="Title color">
                    <span className={`size-3.5 rounded-full ${color.swatch}`} /><span className="hidden sm:inline">{color.label}</span><ChevronDown className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(titleColors) as TitleColor[]).map((c) => (
                    <DropdownMenuItem key={c} onSelect={() => setThreadField("titleColor", c)} className="gap-2">
                      <span className={`size-3.5 rounded-full ${titleColors[c].swatch}`} />{titleColors[c].label}
                      {c === thread.titleColor && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-destructive">{errors.title}</span><span className="text-muted-foreground">{titleValue.length}/{TITLE_MAX}</span></div>
        </section>

        {/* Category + subcategories (tools only) */}
        {tab === "tool" && (
          <section>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</span>
            <div className="scrollbar-none mt-2 flex gap-2 overflow-x-auto pb-1">
              {toolCategories.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => { setToolField("categoryId", c.id); setToolField("subcategoryIds", []); }}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${tool.categoryId === c.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"}`}
                >{c.name}</button>
              ))}
            </div>
            {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId}</p>}

            {tool.categoryId && (
              <>
                <span className="mt-4 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Subcategories</span>
                {subcategories.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No subcategories here yet.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subcategories.map((s) => {
                      const active = tool.subcategoryIds.includes(s.id);
                      return (
                        <button
                          key={s.id} type="button"
                          onClick={() => setToolField("subcategoryIds", active ? tool.subcategoryIds.filter((x) => x !== s.id) : [...tool.subcategoryIds, s.id])}
                          className={`subcat-pill ${active ? "is-active" : ""}`}
                        >
                          {s.iconUrl ? <img src={s.iconUrl} alt="" className="subcat-pill-icon" /> : <span className="subcat-pill-dot" aria-hidden />}
                          <span className="subcat-pill-name">{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.subcategoryIds && <p className="mt-1 text-xs text-destructive">{errors.subcategoryIds}</p>}
              </>
            )}
          </section>
        )}

        {/* Body */}
        <section>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{tab === "thread" ? "Thread content" : "Description"}</span>
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
            <textarea
              ref={bodyRef} value={body} maxLength={BODY_MAX}
              onChange={(e) => set("body", e.target.value)} onFocus={() => setFocused("body")} onKeyDown={onKey("body")}
              placeholder={tab === "thread"
                ? "Write your thread. Blank lines are preserved.\n\nSelect text and use the toolbar, or Ctrl+B / Ctrl+I / Ctrl+U."
                : "Describe what this tool does. The web preview below shows it as it will appear."}
              className="block min-h-56 w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-7 text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-destructive">{errors.body}</span><span className="text-muted-foreground">{words} words · {body.length}/{BODY_MAX}</span></div>
          {body.trim() && (
            <div className="write-web-preview mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase text-muted-foreground">Web preview</p>
              <FormattedText text={body} className="text-sm leading-7 text-foreground/90" />
            </div>
          )}
        </section>

        {/* Thread uploads: images + one file */}
        {tab === "thread" && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="upload-chip" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage || threadImages.length >= MAX_IMAGES}>
                {uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {threadImages.length}/{MAX_IMAGES} images
              </button>
              <button type="button" className="upload-chip" onClick={() => threadFileInputRef.current?.click()} disabled={uploadingFile}>
                {uploadingFile ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                {threadFile ? threadFile.name : "Attach file"}
              </button>
              {threadFile && (
                <button type="button" className="upload-chip is-active" onClick={() => setThreadFile(null)} aria-label="Remove file">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {threadImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {threadImages.map((img) => (
                  <span key={img.id} className="write-thumb">
                    <img src={img.url} alt="" />
                    <button type="button" className="write-thumb-x" onClick={() => setThreadImages((l) => l.filter((i) => i.id !== img.id))} aria-label="Remove image">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onPickImages(e.target.files)} />
            <input ref={threadFileInputRef} type="file" hidden onChange={(e) => void onPickThreadFile(e.target.files)} />
          </section>
        )}

        {/* Tool price + file */}
        {tab === "tool" && (
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tool-price" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount ({currency}) — 0 for free</label>
              <input
                id="tool-price" inputMode="decimal" value={tool.price}
                onChange={(e) => setToolField("price", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price}</p>}
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deliverable file</span>
              <div className="mt-2">
                <button type="button" className="upload-chip" onClick={() => toolFileInputRef.current?.click()} disabled={uploadingFile}>
                  {uploadingFile ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                  {toolFile ? toolFile.name : "Choose file"}
                </button>
                {toolFile && (
                  <button type="button" className="upload-chip is-active ml-2" onClick={() => setToolFile(null)} aria-label="Remove file">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {errors.file && <p className="mt-1 text-xs text-destructive">{errors.file}</p>}
              <input ref={toolFileInputRef} type="file" hidden onChange={(e) => void onPickToolFile(e.target.files)} />
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground"><Trash2 />Discard</Button>
          <Button variant="coralz" onClick={publish} disabled={publishing}><Send />{publishing ? "Posting…" : "Post"}</Button>
        </div>
      </div>

      <PromptDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Insert link"
        description={linkTarget === "title" ? "The link is added to the selected title text." : "The link is added to the selected text."}
        confirmLabel="Insert link"
        onSubmit={(values) => { if (values["url"]?.trim()) { applyLink(values["url"]); setLinkOpen(false); } }}
        fields={[{ key: "url", label: "Link URL", type: "url", placeholder: "https://…", required: true }]}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        description="The saved copy on this device will be cleared."
        confirmLabel="Discard draft"
        danger
        onConfirm={discard}
      />
    </div>
  );
}
