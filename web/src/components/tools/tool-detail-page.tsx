import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarClock, Clock, Download, FileArchive, HardDrive, Lock, Tag,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSite } from "@/hooks/use-site";
import { postsService } from "@/services/posts";
import type { PostDetail } from "@/services/mappers";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function extensionOf(name?: string, mime?: string): string {
  if (name?.includes(".")) return name.split(".").pop()!.toUpperCase();
  if (mime) return mime.split("/").pop()!.toUpperCase();
  return "FILE";
}

export function ToolDetailPage() {
  const { toolId } = useParams({ from: "/tool/$toolId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSite();
  const currency = settings.site_currency?.trim() || "USD";
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    postsService
      .getPost(toolId)
      .then((p) => {
        if (!cancelled) setPost(p);
      })
      .catch(() => {
        if (!cancelled) setError("This tool could not be found.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  const dateLabel = useMemo(() => {
    if (!post?.publishedAtIso) return post?.publishedAt ?? "";
    const d = new Date(post.publishedAtIso);
    return Number.isNaN(d.getTime()) ? post.publishedAt : d.toLocaleDateString();
  }, [post?.publishedAt, post?.publishedAtIso]);

  const timeLabel = useMemo(() => {
    if (!post?.publishedAtIso) return "";
    const d = new Date(post.publishedAtIso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [post?.publishedAtIso]);

  async function handleDownload() {
    if (!post) return;
    setBusy(true);
    setError(null);
    try {
      await postsService.downloadToolFile(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page tool-page">
        <p className="muted-note">Loading…</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="page tool-page">
        <p className="muted-note">{error ?? "Tool not found."}</p>
      </div>
    );
  }

  const paid = (post.price ?? 0) > 0 && post.access === "premium";
  const needsPurchase = paid && !post.hasFileAccess && post.author.id !== user?.id;
  const needsLogin = !user;

  return (
    <div className="page tool-page">
      <div className="category-page-head">
        <button
          type="button"
          className="ghost-back"
          onClick={() => window.history.back()}
          aria-label="Back"
        >
          <ArrowLeft size={15} aria-hidden />
        </button>
        <div>
          <h1 className="category-page-title">{post.title}</h1>
          <p className="category-page-sub">
            {post.subcategory ? `${post.category} · ${post.subcategory}` : post.category}
          </p>
        </div>
      </div>

      <section className="tool-meta">
        <div className="tool-meta-grid">
          <div className="tool-meta-item">
            <Tag size={13} aria-hidden />
            <span>
              <strong>{paid ? `${post.price} ${currency}` : "Free"}</strong>
              <em>Price</em>
            </span>
          </div>
          <div className="tool-meta-item">
            <FileArchive size={13} aria-hidden />
            <span>
              <strong>{extensionOf(post.file?.name, post.file?.mimeType)}</strong>
              <em>File type</em>
            </span>
          </div>
          <div className="tool-meta-item">
            <HardDrive size={13} aria-hidden />
            <span>
              <strong>{formatBytes(post.file?.sizeBytes)}</strong>
              <em>File size</em>
            </span>
          </div>
          <div className="tool-meta-item">
            <CalendarClock size={13} aria-hidden />
            <span>
              <strong>{dateLabel}</strong>
              <em>Posted</em>
            </span>
          </div>
          <div className="tool-meta-item">
            <Clock size={13} aria-hidden />
            <span>
              <strong>{timeLabel || "—"}</strong>
              <em>Time</em>
            </span>
          </div>
        </div>
        {post.file?.name && <p className="tool-file-name">{post.file.name}</p>}
      </section>

      <section className="tool-about">
        <h2>About this tool</h2>
        {post.body ? <p className="tool-about-body">{post.body}</p> : <p className="muted-note">Sign in to read the full description.</p>}
      </section>

      <section className="tool-actions">
        {needsLogin ? (
          <button type="button" className="btn-primary" onClick={() => navigate({ to: "/login" })}>
            <Lock size={14} aria-hidden /> Sign in to get this tool
          </button>
        ) : needsPurchase ? (
          <button type="button" className="btn-primary" disabled title="Payments are coming soon">
            <Lock size={14} aria-hidden /> Purchase required — {post.price} {currency}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={handleDownload} disabled={busy}>
            <Download size={14} aria-hidden /> {busy ? "Preparing…" : "Download"}
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>

      <p className="muted-note">
        Posted by{" "}
        <Link to="/profile/$username" params={{ username: post.author.username }}>
          @{post.author.username}
        </Link>
      </p>
    </div>
  );
}
