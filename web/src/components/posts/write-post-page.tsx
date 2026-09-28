import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bold, Code, EyeOff, Italic, Link2, Quote,
  SquareCode, Strikethrough, Underline, Trash2, Send, Paperclip, X, Loader2,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { FormattedText, FORMAT_MARKERS, type FormatKind } from "@/lib/telegram-format";
import { postsService, CreatePostInput } from "@/services/posts";
import { adminService } from "@/services/admin";
import { ApiError } from "@/services/api";
import { useSite } from "@/hooks/use-site";
import type { Category, Subcategory } from "@/types/community";

const TITLE_MAX = 140;
const BODY_MAX = 20000;
const DRAFT_KEY = "coralz:write-draft";

const toolSchema = z.object({
  title: z.string().trim().min(3, "Name needs at least 3 characters").max(TITLE_MAX),
  body: z.string().refine((v) => v.trim().length >= 10, "Description needs at least 10 characters").refine((v) => v.length <= BODY_MAX, "Description is too long"),
  categoryId: z.string().min(1, "Choose a category"),
  price: z.number().min(0, "Price can't be negative").max(1_000_000),
  subcategoryIds: z.array(z.string()).min(1, "Choose at least one subcategory"),
});

type ToolDraft = {
  title: string;
  body: string;
  categoryId: string;
  price: string;
  subcategoryIds: string[];
};

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

  // ── Tool state ──────────────────────────────────────────────────────────────
  const [tool, setTool] = useState<ToolDraft>(emptyToolDraft);
  const [toolFile, setToolFile] = useState<{ id: string; name: string; size?: number } | null>(null);

  const [focused, setFocused] = useState<"title" | "body">("body");
  const [errors, setErrors] = useState<Partial<Record<"title" | "body" | "categoryId" | "price" | "file" | "subcategoryIds", string>>>({});
  const [publishing, setPublishing] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<"title" | "body">("body");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
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
    enabled: Boolean(tool.categoryId),
    staleTime: 60_000,
  });
  const subcategories: Subcategory[] = subsQuery.data ?? [];

  // Restore an unfinished draft saved on this device.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { tool?: Partial<ToolDraft> };
        if (saved.tool) setTool((d) => ({ ...d, ...saved.tool, price: saved.tool?.price ?? "0", subcategoryIds: saved.tool?.subcategoryIds ?? [] }));
      }
    } catch { /* ignore broken drafts */ }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ tool }));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => clearTimeout(t);
  }, [tool]);

  const setToolField = <K extends keyof ToolDraft>(key: K, value: ToolDraft[K]) => {
    setTool((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const format = (kind: FormatKind, target: "title" | "body" = focused) => {
    if (kind === "link") { setLinkTarget(target); setLinkOpen(true); return; }
    const ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null> = target === "title" ? titleRef : bodyRef;
    const el = ref.current;
    if (!el) return;
    if (target === "title" && (kind === "pre" || kind === "quote")) return;
    const result = applyFormat(el, tool[target] as string, kind);
    if (!result) return;
    setToolField(target, result.next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(result.cursorStart, result.cursorEnd); });
  };

  const applyLink = (url: string) => {
    const el = (linkTarget === "title" ? titleRef : bodyRef).current;
    if (!el) return;
    const result = applyFormat(el, tool[linkTarget] as string, "link", url);
    if (!result) return;
    setToolField(linkTarget, result.next);
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
      finish(created.id, "Tool published");
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

  const finish = (id: string, message: string) => {
    localStorage.removeItem(DRAFT_KEY);
    setTool(emptyToolDraft);
    setToolFile(null);
    toast.success(message);
    navigate({ to: "/tool/$toolId", params: { toolId: id } });
  };

  const clear = () => setDiscardOpen(true);
  const discard = () => {
    setTool(emptyToolDraft);
    setToolFile(null);
    localStorage.removeItem(DRAFT_KEY);
    setDiscardOpen(false);
    toast.success("Draft discarded");
  };

  const body = tool.body;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Share a tool</h1>
          <p className="mt-1 text-xs text-muted-foreground">{savedAt ? `Draft saved on this device · ${savedAt}` : "Drafts save automatically on this device"}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {/* Title */}
        <section>
          <label htmlFor="post-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tool name</label>
          <div className="mt-2 flex items-center gap-2 border-b border-border focus-within:border-primary">
            <input
              id="post-title" ref={titleRef} value={tool.title} maxLength={TITLE_MAX}
              onChange={(e) => setToolField("title", e.target.value)} onFocus={() => setFocused("title")} onKeyDown={onKey("title")}
              placeholder="Name your tool"
              className="min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground text-foreground"
            />
          </div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-destructive">{errors.title}</span><span className="text-muted-foreground">{tool.title.length}/{TITLE_MAX}</span></div>
        </section>

        {/* Category + subcategories */}
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

        {/* Body */}
        <section>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</span>
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
              onChange={(e) => setToolField("body", e.target.value)} onFocus={() => setFocused("body")} onKeyDown={onKey("body")}
              placeholder="Describe what this tool does. The web preview below shows it as it will appear."
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

        {/* Price + deliverable file */}
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
