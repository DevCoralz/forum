import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, Ban, Crown, Flag, Gavel, KeyRound, Loader2, Lock, Megaphone,
  Palette, Plus, ShieldCheck, Tag, Trash2, TriangleAlert, UserPlus, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { adminService } from "@/services/admin";
import { ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import type { AdSlide, AdminUser, TagDefinition } from "@/types/admin";

type AdminTab = "users" | "tags" | "site" | "ads" | "coming";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "tags", label: "Tags" },
  { id: "site", label: "Site" },
  { id: "ads", label: "Ads" },
  { id: "coming", label: "Settings" },
];

function errText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}


export function AdminCenter() {
  const { user, status } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");

  if (status === "loading") return <LoadingSpinner />;
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="section-title">Admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">You are not authorized to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="section-title text-2xl">Admin Management Center</h1>
          <span className="text-xs text-muted-foreground">Signed in as @{user.username} · {user.role}</span>
        </header>
        <nav className="admin-tabs" aria-label="Admin sections">
          {TABS.map((entry) => (
            <button key={entry.id} data-active={tab === entry.id} onClick={() => setTab(entry.id)}>
              {entry.id === "users" && <ShieldCheck className="size-3.5" />}
              {entry.id === "tags" && <Tag className="size-3.5" />}
              {entry.id === "site" && <Wrench className="size-3.5" />}
              {entry.id === "ads" && <Megaphone className="size-3.5" />}
              {entry.id === "coming" && <Lock className="size-3.5" />}
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="admin-panel">
          {tab === "users" && <UsersTab />}
          {tab === "tags" && <TagsTab />}
          {tab === "site" && <SiteTab />}
          {tab === "ads" && <AdsTab />}
          {tab === "coming" && <ComingSoonTab />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Users ──────────────────────────────────────────────────────────────────── */

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const query = useQuery({
    queryKey: ["admin-users", search, statusFilter],
    queryFn: () => adminService.listUsers({ search, status: statusFilter, limit: 100 }),
  });

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown> }) => run(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Done");
    },
    onError: (error) => toast.error(errText(error, "Action failed")),
  });
  const run = (fn: () => Promise<unknown>) => act.mutate({ run: fn });

  const users: AdminUser[] = query.data?.items ?? [];

  function confirmAction(question: string, fn: () => Promise<unknown>) {
    if (window.confirm(question)) run(fn);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="admin-input"
          placeholder="Search username or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search members"
        />
        <select className="admin-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="flagged">Flagged</option>
        </select>
        <CreateMemberForm onCreate={(body) => run(() => adminService.createMember(body))} />
      </div>

      {query.isLoading && <LoadingSpinner />}
      {!query.isLoading && users.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No member</p>}

      <ul className="admin-user-list">
        {users.map((member) => (
          <li key={member.id} className="admin-user-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm">{member.username}</strong>
                <span className={`role-chip role-${member.role}`}>{member.role}</span>
                {member.is_verified_tick && <BadgeCheck className="size-3.5 text-primary" aria-label="Verified" />}
                {member.is_banned && <span className="status-chip status-banned">Banned</span>}
                {member.is_suspended && !member.is_banned && <span className="status-chip status-suspended">Suspended</span>}
                {member.is_flagged && <span className="status-chip status-flagged">Flagged</span>}
                {member.tags.map((tag) => (
                  <span key={tag.name} className="tag-shimmer" style={{ "--tag-color": tag.color } as React.CSSProperties}>{tag.name}</span>
                ))}
              </div>
              <small className="block truncate text-xs text-muted-foreground">{member.email} · joined {new Date(member.created_at).toLocaleDateString()}</small>
            </div>
            <div className="admin-actions">
              {member.role === "free" && (
                <button title="Upgrade to premium" onClick={() => run(() => adminService.setTier(member.id, "premium"))}><Crown className="size-3.5" />Premium</button>
              )}
              {member.role === "premium" && (
                <button title="Downgrade to free" onClick={() => run(() => adminService.setTier(member.id, "free"))}>To free</button>
              )}
              {!member.is_banned && !member.is_suspended && (
                <button title="Suspend" onClick={() => {
                  const daysRaw = window.prompt("Suspend for how many days? Leave empty for indefinite.");
                  if (daysRaw === null) return;
                  const days = daysRaw ? Number(daysRaw) : null;
                  const reason = window.prompt("Reason (optional)") ?? "";
                  run(() => adminService.suspend(member.id, { days, reason }));
                }}><Gavel className="size-3.5" />Suspend</button>
              )}
              {(member.is_suspended || member.is_banned) && (
                <button title="Lift suspension / unban" onClick={() => run(() => adminService.unsuspend(member.id))}>Lift</button>
              )}
              {!member.is_banned && (
                <button title="Ban" onClick={() => {
                  const reason = window.prompt("Ban reason (optional)") ?? "";
                  confirmAction(`Ban ${member.username}?`, () => adminService.ban(member.id, reason));
                }}><Ban className="size-3.5" />Ban</button>
              )}
              {member.is_flagged
                ? <button title="Lift flag" onClick={() => run(() => adminService.unflag(member.id))}>Unflag</button>
                : <button title="Flag as warning" onClick={() => {
                  const reason = window.prompt("Flag reason (optional)") ?? "";
                  run(() => adminService.flag(member.id, reason));
                }}><Flag className="size-3.5" />Flag</button>}
              <button title={member.is_verified_tick ? "Remove verified badge" : "Give verified badge"} onClick={() => run(() => adminService.setVerifiedTick(member.id, !member.is_verified_tick))}>
                <BadgeCheck className="size-3.5" />{member.is_verified_tick ? "Untick" : "Verify"}
              </button>
              <button title="Give a tag" onClick={() => {
                const name = window.prompt("Tag name");
                if (!name) return;
                const color = window.prompt("Tag color (hex, e.g. #FFC928)", "#FFC928") ?? "#FFC928";
                run(() => adminService.addTag(member.id, name, color));
              }}><Tag className="size-3.5" />Tag</button>
              {member.tags.map((tag) => (
                <button key={tag.name} title={`Remove tag ${tag.name}`} onClick={() => run(() => adminService.removeTag(member.id, tag.name))}>
                  <X className="size-3" />{tag.name}
                </button>
              ))}
              <button title="Reset password" onClick={() => {
                const password = window.prompt("New password (min 8 characters)");
                if (!password || password.length < 8) return;
                run(() => adminService.resetPassword(member.id, password));
              }}><KeyRound className="size-3.5" />Password</button>
              <button title="Delete account" className="danger" onClick={() => confirmAction(`Delete ${member.username}'s account? This cannot be undone.`, () => adminService.deleteMember(member.id))}>
                <Trash2 className="size-3.5" />Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateMemberForm({ onCreate }: { onCreate: (body: { username: string; email: string; password: string; role: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ username: "", email: "", password: "", role: "free" });
  if (!open) {
    return <button className="admin-input admin-btn" onClick={() => setOpen(true)}><UserPlus className="size-3.5" />Create member</button>;
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(draft);
        setOpen(false);
        setDraft({ username: "", email: "", password: "", role: "free" });
      }}
    >
      <input className="admin-input" placeholder="username" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} required minLength={3} pattern="[A-Za-z0-9_]+" />
      <input className="admin-input" type="email" placeholder="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
      <input className="admin-input" type="password" placeholder="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required minLength={8} />
      <select className="admin-input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
        <option value="free">free</option>
        <option value="premium">premium</option>
      </select>
      <button type="submit" className="admin-input admin-btn"><Plus className="size-3.5" />Create</button>
      <button type="button" className="admin-input admin-btn" onClick={() => setOpen(false)}><X className="size-3.5" /></button>
    </form>
  );
}

/* ── Tags ───────────────────────────────────────────────────────────────────── */

function TagsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-tags"], queryFn: adminService.listTags });
  const [draft, setDraft] = useState({ name: "", color: "#FFC928" });

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown> }) => run(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      toast.success("Saved");
    },
    onError: (error) => toast.error(errText(error, "Action failed")),
  });
  const tags: TagDefinition[] = query.data?.items ?? [];

  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          act.mutate({ run: () => adminService.upsertTag(draft.name.trim(), draft.color) });
          setDraft({ name: "", color: "#FFC928" });
        }}
      >
        <input className="admin-input" placeholder="Tag name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        <input className="admin-input admin-color" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} aria-label="Tag color" />
        <button type="submit" className="admin-input admin-btn"><Plus className="size-3.5" />Add / update</button>
      </form>
      <p className="mb-4 text-xs text-muted-foreground">Editing a tag updates its name and shimmer color everywhere it is worn.</p>
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag.name} className="admin-tag-row">
            <span className="tag-shimmer" style={{ "--tag-color": tag.color } as React.CSSProperties}>{tag.name}</span>
            <input
              className="admin-input admin-color"
              type="color"
              defaultValue={tag.color}
              onBlur={(event) => {
                if (event.target.value !== tag.color) {
                  act.mutate({ run: () => adminService.upsertTag(tag.name, event.target.value) });
                }
              }}
              aria-label={`${tag.name} color`}
            />
            <button className="danger" title="Delete tag" onClick={() => {
              if (window.confirm(`Delete tag ${tag.name} from every member?`)) {
                act.mutate({ run: () => adminService.deleteTag(tag.name) });
              }
            }}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      {!query.isLoading && tags.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No tag</p>}
    </div>
  );
}

/* ── Site settings ──────────────────────────────────────────────────────────── */

function SiteTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-site"], queryFn: adminService.getSiteSettings });
  const [draft, setDraft] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (values: Record<string, string>) => adminService.putSiteSettings(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-site"] });
      void queryClient.invalidateQueries({ queryKey: ["site"] });
      toast.success("Site settings saved");
    },
    onError: (error) => toast.error(errText(error, "Could not save settings")),
  });

  if (query.isLoading) return <LoadingSpinner />;
  const settings = { ...query.data, ...draft };
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(draft).length > 0;

  async function upload(key: string, file: File | null) {
    if (!file) return;
    try {
      const media = await adminService.uploadMedia(file);
      save.mutate({ [key]: media.id });
    } catch (error) {
      toast.error(errText(error, "Upload failed"));
    }
  }

  return (
    <div className="admin-grid">
      <label>Site name
        <input className="admin-input" value={settings.site_name ?? ""} onChange={(e) => set("site_name", e.target.value)} />
      </label>
      <label>Currency
        <input className="admin-input" value={settings.site_currency ?? ""} onChange={(e) => set("site_currency", e.target.value)} />
      </label>
      <label className="admin-span2">Footer text
        <input className="admin-input" value={settings.site_footer ?? ""} onChange={(e) => set("site_footer", e.target.value)} />
      </label>
      <label className="admin-span2">Site description
        <textarea className="admin-input" rows={2} value={settings.site_description ?? ""} onChange={(e) => set("site_description", e.target.value)} />
      </label>
      <label className="admin-span2">Keywords
        <input className="admin-input" value={settings.site_keywords ?? ""} onChange={(e) => set("site_keywords", e.target.value)} />
      </label>
      <label>Site mode
        <select className="admin-input" value={settings.site_mode ?? "production"} onChange={(e) => set("site_mode", e.target.value)}>
          <option value="production">Production</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </label>
      <label>Registration
        <select className="admin-input" value={settings.registration_open ?? "true"} onChange={(e) => set("registration_open", e.target.value)}>
          <option value="true">Open</option>
          <option value="false">Closed</option>
        </select>
      </label>
      <label>Social preview title
        <input className="admin-input" value={settings.og_title ?? ""} onChange={(e) => set("og_title", e.target.value)} />
      </label>
      <label>Social preview description
        <input className="admin-input" value={settings.og_description ?? ""} onChange={(e) => set("og_description", e.target.value)} />
      </label>

      {([
        ["site_logo_media_id", "Site image (next to the name)", settings.site_logo_url],
        ["site_favicon_media_id", "Favicon", settings.site_favicon_url],
        ["site_og_media_id", "Social preview image", settings.site_og_url],
      ] as const).map(([key, label, url]) => (
        <label key={key} className="admin-media">
          <span>{label}</span>
          <span className="admin-media-preview">
            {url && <img src={url} alt={label} />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" onChange={(e) => void upload(key, e.target.files?.[0] ?? null)} />
          </span>
        </label>
      ))}

      <div className="admin-span2">
        <button
          className="admin-input admin-btn"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(draft)}
        >
          {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
          Save settings
        </button>
      </div>
    </div>
  );
}

/* ── Ads ────────────────────────────────────────────────────────────────────── */

function AdsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-ads"], queryFn: adminService.listAds });
  const [draft, setDraft] = useState<{
    media_id: string; media_type: "image" | "video"; description: string; url: string; sort_order: number;
  }>({ media_id: "", media_type: "image", description: "", url: "", sort_order: 0 });
  const [uploading, setUploading] = useState(false);

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown> }) => run(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      void queryClient.invalidateQueries({ queryKey: ["site"] });
      toast.success("Saved");
    },
    onError: (error) => toast.error(errText(error, "Action failed")),
  });

  const ads: AdSlide[] = query.data?.items ?? [];

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const media = await adminService.uploadMedia(file);
      setDraft((current) => ({
        ...current,
        media_id: media.id,
        media_type: media.kind === "video" ? "video" : "image",
      }));
    } catch (error) {
      toast.error(errText(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <form
        className="mb-6 grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.media_id) { toast.error("Upload an image or video first"); return; }
          if (ads.filter((ad) => ad.is_active).length >= 5) { toast.error("At most 5 active ad slides are allowed"); return; }
          act.mutate({
            run: () => adminService.createAd({
              ...draft,
              url: draft.url || null,
              media_id: draft.media_id || null,
            }),
          });
          setDraft({ media_id: "", media_type: "image", description: "", url: "", sort_order: 0 });
        }}
      >
        <input className="admin-input" type="file" accept="image/*,video/mp4,video/webm" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} aria-label="Ad media" />
        <input className="admin-input" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} />
        <input className="admin-input" placeholder="Visit URL (https://…)" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        <input className="admin-input" type="number" min={0} placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
        <button type="submit" className="admin-input admin-btn" disabled={uploading || act.isPending}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          {draft.media_id ? "Add slide" : "Add slide (upload first)"}
        </button>
      </form>

      <ul className="admin-user-list">
        {ads.map((ad) => (
          <li key={ad.id} className="admin-user-row">
            <div className="flex min-w-0 items-center gap-3">
              {ad.media_url && ad.media_type === "image" && <img src={ad.media_url} alt="" className="h-10 w-16 rounded object-cover" />}
              <div className="min-w-0">
                <strong className="block truncate text-sm">{ad.description || "(no description)"}</strong>
                <small className="text-xs text-muted-foreground">{ad.media_type} · #{ad.sort_order} · {ad.is_active ? "active" : "hidden"}{ad.url ? ` · ${ad.url}` : ""}</small>
              </div>
            </div>
            <div className="admin-actions">
              <button onClick={() => act.mutate({ run: () => adminService.updateAd(ad.id, { is_active: !ad.is_active }) })}>
                {ad.is_active ? "Hide" : "Show"}
              </button>
              <button className="danger" onClick={() => {
                if (window.confirm("Delete this ad slide?")) {
                  act.mutate({ run: () => adminService.deleteAd(ad.id) });
                }
              }}><Trash2 className="size-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
      {!query.isLoading && ads.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No ad</p>}
      <p className="mt-4 text-xs text-muted-foreground">Visitors see the ad carousel first: slides auto-advance, videos play muted and advance when they finish, and it loops back around.</p>
    </div>
  );
}

/* ── Placeholders ───────────────────────────────────────────────────────────── */

const COMING_SOON = [
  { name: "Payments", icon: KeyRound, note: "Payment provider keys and checkout settings." },
  { name: "Plans", icon: Crown, note: "Free and premium plan pricing and limits." },
  { name: "Languages", icon: ShieldCheck, note: "Interface languages and defaults." },
  { name: "Categories", icon: Palette, note: "Categories and subcategories management." },
  { name: "Thread settings", icon: Gavel, note: "Default thread behavior and limits." },
  { name: "Notifications", icon: TriangleAlert, note: "Announcement and notification settings." },
];

function ComingSoonTab() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {COMING_SOON.map((entry) => (
        <li key={entry.name} className="admin-coming">
          <entry.icon className="size-4 text-primary" />
          <div>
            <strong className="text-sm">{entry.name}</strong>
            <p className="text-xs text-muted-foreground">{entry.note}</p>
            <span className="status-chip status-flagged">Coming soon</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
