import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, Ban, Crown, Database, Cookie, FileText, Flame, FolderPlus, Grid2X2,
  Eye, EyeOff, Flag, Gavel, ImagePlus, KeyRound, Loader2, Lock, Megaphone,
  Palette, Pencil, Plus, Settings as SettingsIcon, ShieldCheck, Tag, Trash2, TriangleAlert,
  UserPlus, Wrench, X,
} from "lucide-react";
import { SITE_SOCIAL_PLATFORMS } from "@/lib/site-socials";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { adminService } from "@/services/admin";
import { ApiError, assetUrl } from "@/services/api";
import { ThemeSelect } from "@/components/ui/theme-select";
import { NotFoundPage } from "@/components/common/not-found-page";
import { useAuth } from "@/hooks/use-auth";
import type { AdSlide, AdminUser, TagDefinition } from "@/types/admin";
import type { CategoryWithCountRaw, SubcategoryWithCountRaw } from "@/services/admin";

type AdminTab = "users" | "tags" | "categories" | "site" | "ads" | "coming";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "tags", label: "Tags" },
  { id: "categories", label: "Categories" },
  { id: "site", label: "Site" },
  { id: "ads", label: "Ads" },
  { id: "coming", label: "Settings" },
];

function errText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Small circular spinner shown inside a button while its own request runs. */
function BusySpinner() {
  return <Loader2 className="size-3.5 animate-spin" aria-label="Working" />;
}


export function AdminCenter() {
  const { user, status } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");

  if (status === "loading") return <LoadingSpinner />;
  // Non-staff see the ordinary 404 so the admin area does not reveal it exists.
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return <NotFoundPage />;
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
          {tab === "categories" && <CategoriesTab />}
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

type UserDialog =
  | { kind: "suspend"; member: AdminUser }
  | { kind: "ban"; member: AdminUser }
  | { kind: "flag"; member: AdminUser }
  | { kind: "password"; member: AdminUser }
  | { kind: "tag"; member: AdminUser }
  | { kind: "delete"; member: AdminUser };

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<UserDialog | null>(null);
  const [dialogPending, setDialogPending] = useState(false);

  const query = useQuery({
    queryKey: ["admin-users", search, statusFilter],
    queryFn: () => adminService.listUsers({ search, status: statusFilter, limit: 100 }),
  });
  const tagsQuery = useQuery({ queryKey: ["admin-tags"], queryFn: adminService.listTags });
  const tagOptions: TagDefinition[] = tagsQuery.data?.items ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    void queryClient.invalidateQueries({ queryKey: ["site"] });
  };

  /** Runs one action with its own circular loading state on that button only. */
  const run = async (key: string, fn: () => Promise<unknown>, successMsg = "Done") => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
      refresh();
      toast.success(successMsg);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const submitDialog = async (fn: () => Promise<unknown>, successMsg: string) => {
    if (dialogPending) return;
    setDialogPending(true);
    try {
      await fn();
      refresh();
      toast.success(successMsg);
      setDialog(null);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setDialogPending(false);
    }
  };

  const users: AdminUser[] = query.data?.items ?? [];

  const renderDialog = () => {
    if (!dialog) return null;
    const name = dialog.member.username;
    const close = () => { if (!dialogPending) setDialog(null); };

    if (dialog.kind === "delete") {
      return (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Delete ${name}'s account?`}
          description="This permanently removes the member and their threads. It cannot be undone."
          confirmLabel="Delete member"
          danger
          pending={dialogPending}
          onConfirm={() => submitDialog(() => adminService.deleteMember(dialog.member.id), "Member deleted")}
        />
      );
    }
    if (dialog.kind === "suspend") {
      return (
        <PromptDialog
          open
          onOpenChange={close}
          title={`Suspend ${name}`}
          description="Leave days empty to suspend indefinitely."
          confirmLabel="Suspend"
          pending={dialogPending}
          onSubmit={(values) => submitDialog(
            () => adminService.suspend(dialog.member.id, {
              days: values["days"] ? Number(values["days"]) : null,
              reason: values["reason"] || null,
            }),
            "Member suspended",
          )}
          fields={[
            { key: "days", label: "Days", type: "number", min: 1, placeholder: "e.g. 7 (empty = indefinite)" },
            { key: "reason", label: "Reason (optional)", type: "textarea", placeholder: "Why is this member suspended?" },
          ]}
        />
      );
    }
    if (dialog.kind === "ban") {
      return (
        <PromptDialog
          open
          onOpenChange={close}
          title={`Ban ${name}?`}
          description="A banned member cannot log in or view threads."
          confirmLabel="Ban member"
          pending={dialogPending}
          onSubmit={(values) => submitDialog(
            () => adminService.ban(dialog.member.id, values["reason"] || undefined),
            "Member banned",
          )}
          fields={[{ key: "reason", label: "Reason (optional)", type: "textarea", placeholder: "Why is this member banned?" }]}
        />
      );
    }
    if (dialog.kind === "flag") {
      return (
        <PromptDialog
          open
          onOpenChange={close}
          title={`Flag ${name}`}
          description="The member sees a warning banner with this reason."
          confirmLabel="Flag member"
          pending={dialogPending}
          onSubmit={(values) => submitDialog(
            () => adminService.flag(dialog.member.id, values["reason"] || undefined),
            "Member flagged",
          )}
          fields={[{ key: "reason", label: "Reason (optional)", type: "textarea", placeholder: "Warning shown to the member" }]}
        />
      );
    }
    if (dialog.kind === "password") {
      return (
        <PromptDialog
          open
          onOpenChange={close}
          title={`Reset password for ${name}`}
          confirmLabel="Reset password"
          pending={dialogPending}
          onSubmit={(values) => submitDialog(
            () => adminService.resetPassword(dialog.member.id, values["password"] || ""),
            "Password reset",
          )}
          fields={[
            { key: "password", label: "New password", type: "password", required: true, minLength: 8, placeholder: "At least 8 characters" },
          ]}
        />
      );
    }
    if (dialog.kind === "tag") {
      return <AssignTagDialog open onOpenChange={close} member={dialog.member} tags={tagOptions} pending={dialogPending} onAssign={(tagName, color) => submitDialog(() => adminService.addTag(dialog.member.id, tagName, color), "Tag assigned")} />;
    }
    return null;
  };

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
        <ThemeSelect ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" },
          { value: "banned", label: "Banned" }, { value: "flagged", label: "Flagged" },
        ]} />
        <CreateMemberForm busy={busyKey === "create-member"} onCreate={(body) => run("create-member", () => adminService.createMember(body), "Member created")} />
      </div>

      {query.isLoading && <LoadingSpinner />}
      {!query.isLoading && users.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No member</p>}

      <ul className="admin-user-list">
        {users.map((member) => {
          const busy = (key: string) => busyKey === `${member.id}:${key}`;
          return (
            <li key={member.id} className="admin-user-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{member.username}</strong>
                  <span className={`role-chip role-${member.role}`}>{member.role}</span>
                  {member.is_verified_tick && <VerifiedBadge />}
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
                  <button title="Upgrade to premium" disabled={busy("tier")} onClick={() => run(`${member.id}:tier`, () => adminService.setTier(member.id, "premium"), "Moved to premium")}>
                    {busy("tier") ? <BusySpinner /> : <Crown className="size-3.5" />}Premium
                  </button>
                )}
                {member.role === "premium" && (
                  <button title="Downgrade to free" disabled={busy("tier")} onClick={() => run(`${member.id}:tier`, () => adminService.setTier(member.id, "free"), "Moved to free")}>
                    {busy("tier") ? <BusySpinner /> : null}To free
                  </button>
                )}
                {!member.is_banned && !member.is_suspended && (
                  <button title="Suspend" disabled={busy("suspend")} onClick={() => setDialog({ kind: "suspend", member })}>
                    {busy("suspend") ? <BusySpinner /> : <Gavel className="size-3.5" />}Suspend
                  </button>
                )}
                {(member.is_suspended || member.is_banned) && (
                  <button title="Lift suspension / unban" disabled={busy("lift")} onClick={() => run(`${member.id}:lift`, () => adminService.unsuspend(member.id), "Restriction lifted")}>
                    {busy("lift") ? <BusySpinner /> : null}Lift
                  </button>
                )}
                {!member.is_banned && (
                  <button title="Ban" disabled={busy("ban")} onClick={() => setDialog({ kind: "ban", member })}>
                    {busy("ban") ? <BusySpinner /> : <Ban className="size-3.5" />}Ban
                  </button>
                )}
                {member.is_flagged
                  ? <button title="Lift flag" disabled={busy("flag")} onClick={() => run(`${member.id}:flag`, () => adminService.unflag(member.id), "Flag removed")}>{busy("flag") ? <BusySpinner /> : null}Unflag</button>
                  : <button title="Flag as warning" disabled={busy("flag")} onClick={() => setDialog({ kind: "flag", member })}>{busy("flag") ? <BusySpinner /> : <Flag className="size-3.5" />}Flag</button>}
                <button title={member.is_verified_tick ? "Remove verified badge" : "Give verified badge"} disabled={busy("verify")} onClick={() => run(`${member.id}:verify`, () => adminService.setVerifiedTick(member.id, !member.is_verified_tick), member.is_verified_tick ? "Badge removed" : "Badge given")}>
                  {busy("verify") ? <BusySpinner /> : <BadgeCheck className="size-3.5" />}{member.is_verified_tick ? "Untick" : "Verify"}
                </button>
                <button title="Give a tag" disabled={busy("addtag")} onClick={() => setDialog({ kind: "tag", member })}>
                  {busy("addtag") ? <BusySpinner /> : <Tag className="size-3.5" />}Tag
                </button>
                {member.tags.map((tag) => (
                  <button key={tag.name} title={`Remove tag ${tag.name}`} disabled={busy(`rmtag:${tag.name}`)} onClick={() => run(`${member.id}:rmtag:${tag.name}`, () => adminService.removeTag(member.id, tag.name), "Tag removed")}>
                    {busy(`rmtag:${tag.name}`) ? <BusySpinner /> : <X className="size-3" />}{tag.name}
                  </button>
                ))}
                <button title="Reset password" disabled={busy("password")} onClick={() => setDialog({ kind: "password", member })}>
                  {busy("password") ? <BusySpinner /> : <KeyRound className="size-3.5" />}Password
                </button>
                <button title="Delete account" className="danger" disabled={busy("delete")} onClick={() => setDialog({ kind: "delete", member })}>
                  {busy("delete") ? <BusySpinner /> : <Trash2 className="size-3.5" />}Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {renderDialog()}
    </div>
  );
}

/** Pick from tags an admin already created, then choose the color it is worn with. */
function AssignTagDialog({
  open, onOpenChange, member, tags, pending, onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: AdminUser;
  tags: TagDefinition[];
  pending: boolean;
  onAssign: (name: string, color: string) => void;
}) {
  const worn = new Set(member.tags.map((tag) => tag.name));
  const available = tags.filter((tag) => !worn.has(tag.name));
  const [name, setName] = useState(available[0]?.name ?? "");
  const [color, setColor] = useState(available[0]?.color ?? "#FFC928");

  useEffect(() => {
    if (open) {
      setName(available[0]?.name ?? "");
      setColor(available[0]?.color ?? "#FFC928");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-base text-foreground">Give {member.username} a tag</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every created tag is already worn by this member{tags.length === 0 ? " — create tags on the Tags tab first" : ""}.
          </p>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => { event.preventDefault(); if (name) onAssign(name, color); }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Tag
              <ThemeSelect className="w-full" ariaLabel="Tag" value={name} onChange={(next) => {
                setName(next);
                const found = available.find((tag) => tag.name === next);
                if (found) setColor(found.color);
              }} options={available.map((tag) => ({ value: tag.name, label: tag.name }))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Color on this member
              <span className="flex items-center gap-2">
                <input type="color" className="admin-input admin-color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Tag color" />
                <code className="text-[11px] text-muted-foreground">{color}</code>
              </span>
              <span className="text-[11px] font-normal">Defaults to the tag's saved color; you can tune it per member.</span>
            </label>
            <DialogFooter className="mt-1 gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="coralz" size="sm" disabled={pending || !name}>
                {pending && <BusySpinner />}
                Assign tag
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateMemberForm({ onCreate, busy }: { onCreate: (body: { username: string; email: string; password: string; role: string }) => void; busy: boolean }) {
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
      <ThemeSelect ariaLabel="Role" value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })}
        options={[{ value: "free", label: "free" }, { value: "premium", label: "premium" }]} />
      <button type="submit" className="admin-input admin-btn" disabled={busy}>{busy ? <BusySpinner /> : <Plus className="size-3.5" />}Create</button>
      <button type="button" className="admin-input admin-btn" onClick={() => setOpen(false)}><X className="size-3.5" /></button>
    </form>
  );
}

/* ── Tags ───────────────────────────────────────────────────────────────────── */

function TagsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-tags"], queryFn: adminService.listTags });
  const [draft, setDraft] = useState({ name: "", color: "#FFC928" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deleteTag, setDeleteTag] = useState<TagDefinition | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-tags"] });

  const run = async (key: string, fn: () => Promise<unknown>, successMsg = "Saved") => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
      refresh();
      toast.success(successMsg);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const tags: TagDefinition[] = query.data?.items ?? [];

  const confirmDelete = async () => {
    if (!deleteTag) return;
    setDeletePending(true);
    try {
      await adminService.deleteTag(deleteTag.name);
      refresh();
      toast.success("Tag deleted");
      setDeleteTag(null);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          run("create-tag", () => adminService.upsertTag(draft.name.trim(), draft.color), "Tag saved");
          setDraft({ name: "", color: "#FFC928" });
        }}
      >
        <input className="admin-input" placeholder="Tag name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        <input className="admin-input admin-color" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} aria-label="Tag color" />
        <button type="submit" className="admin-input admin-btn" disabled={busyKey === "create-tag"}>
          {busyKey === "create-tag" ? <BusySpinner /> : <Plus className="size-3.5" />}Add / update
        </button>
      </form>
      <p className="mb-4 text-xs text-muted-foreground">Members can only be tagged with tags created here. Editing a tag updates its name and shimmer color everywhere it is worn.</p>
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
                  run(`color:${tag.name}`, () => adminService.upsertTag(tag.name, event.target.value));
                }
              }}
              aria-label={`${tag.name} color`}
            />
            <button className="danger" title="Delete tag" disabled={busyKey === `delete:${tag.name}`} onClick={() => setDeleteTag(tag)}>
              {busyKey === `delete:${tag.name}` ? <BusySpinner /> : <Trash2 className="size-3.5" />}
            </button>
          </li>
        ))}
      </ul>
      {!query.isLoading && tags.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No tag</p>}
      <ConfirmDialog
        open={deleteTag !== null}
        onOpenChange={(open) => { if (!open) setDeleteTag(null); }}
        title={`Delete tag "${deleteTag?.name ?? ""}"?`}
        description="It is removed from every member who wears it."
        confirmLabel="Delete tag"
        danger
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/* ── Site settings ──────────────────────────────────────────────────────────── */

/* ── Categories & subcategories ─────────────────────────────────────────────── */

const CATEGORY_ICONS = {
  flame: Flame, settings: SettingsIcon, crown: Crown, database: Database,
  cookie: Cookie, file: FileText, grid: Grid2X2,
} as const;
type CategoryIconName = keyof typeof CATEGORY_ICONS;

interface IconDraft { preset: string | null; mediaId: string | null }

function CategoryGlyph({ icon, url }: { icon?: string | null; url?: string | null }) {
  if (url) return <img src={url} alt="" className="size-4 rounded object-cover" />;
  const Icon = CATEGORY_ICONS[(icon ?? "grid") as CategoryIconName] ?? Grid2X2;
  return <Icon className="size-4" aria-hidden />;
}

function IconPicker({ draft, onChange, busyKey, busyId, onUpload }: {
  draft: IconDraft;
  onChange: (next: IconDraft) => void;
  busyKey: string | null;
  busyId: string;
  onUpload: (file: File | null, key: string) => void;
}) {
  return (
    <div className="admin-icon-picker">
      {(Object.keys(CATEGORY_ICONS) as CategoryIconName[]).map((name) => (
        <button
          key={name}
          type="button"
          className="admin-icon-pick"
          data-active={draft.preset === name && !draft.mediaId}
          onClick={() => onChange({ preset: name, mediaId: null })}
          aria-label={`Use the ${name} icon`}
        >
          <CategoryGlyph icon={name} />
        </button>
      ))}
      <label className="admin-upload">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
          hidden
          onChange={(e) => { onUpload(e.target.files?.[0] ?? null, busyId); e.target.value = ""; }}
        />
        <span className="admin-input admin-btn" aria-hidden="true">
          {busyKey === busyId ? <BusySpinner /> : <ImagePlus className="size-3.5" />}
          Image
        </span>
      </label>
      {draft.mediaId && (
        <span className="admin-icon-current" title="Uploaded image icon">
          <CategoryGlyph icon={null} url={assetUrl(`/api/v1/media/${draft.mediaId}`) ?? null} />
        </span>
      )}
    </div>
  );
}

function CategoriesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-categories"], queryFn: adminService.listAdminCategories });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<IconDraft>({ preset: null, mediaId: null });
  const [editCat, setEditCat] = useState<CategoryWithCountRaw | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<IconDraft>({ preset: null, mediaId: null });
  const [editHidden, setEditHidden] = useState(false);
  const [deleteCat, setDeleteCat] = useState<CategoryWithCountRaw | null>(null);
  const [subTarget, setSubTarget] = useState<CategoryWithCountRaw | null>(null);
  const [subName, setSubName] = useState("");
  const [subIcon, setSubIcon] = useState<IconDraft>({ preset: null, mediaId: null });
  const [subEdit, setSubEdit] = useState<SubcategoryWithCountRaw | null>(null);
  const [subEditName, setSubEditName] = useState("");
  const [subEditIcon, setSubEditIcon] = useState<IconDraft>({ preset: null, mediaId: null });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["site"] }),
    ]);
  };

  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusyKey(key);
    setFormError(null);
    try {
      await action();
      toast.success(done);
      await refresh();
    } catch (e) {
      const message = errText(e, "Something went wrong");
      setFormError(message);
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function uploadIcon(file: File | null, key: string, set: (d: IconDraft) => void) {
    if (!file) return;
    setBusyKey(key);
    try {
      const media = await adminService.uploadMedia(file);
      set({ preset: null, mediaId: media.id });
    } catch (e) {
      toast.error(errText(e, "Upload failed"));
    } finally {
      setBusyKey(null);
    }
  }

  if (query.isLoading) return <LoadingSpinner />;
  const data = query.data ?? { items: [], subcategories: {} };

  const openEdit = (category: CategoryWithCountRaw) => {
    setEditCat(category);
    setEditName(category.name);
    setEditIcon({ preset: category.icon ?? null, mediaId: category.icon_media_id ?? null });
    setEditHidden(Boolean(category.is_hidden));
  };
  const openSubCreate = (category: CategoryWithCountRaw) => {
    setSubTarget(category);
    setSubName("");
    setSubIcon({ preset: null, mediaId: null });
  };
  const openSubEdit = (sub: SubcategoryWithCountRaw) => {
    setSubEdit(sub);
    setSubEditName(sub.name);
    setSubEditIcon({ preset: sub.icon ?? null, mediaId: sub.icon_media_id ?? null });
  };

  return (
    <div className="admin-grid">
      <div className="admin-card admin-span2">
        <strong>Create a category</strong>
        <div className="admin-inline-row">
          <input
            className="admin-input"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <IconPicker draft={newIcon} onChange={setNewIcon} busyKey={busyKey} busyId="new-cat-icon" onUpload={(f) => uploadIcon(f, "new-cat-icon", setNewIcon)} />
          <button
            className="admin-input admin-btn"
            disabled={busyKey !== null || !newName.trim()}
            onClick={() => {
              const name = newName.trim();
              setBusyKey("create-cat");
              run("create-cat", () => adminService.createCategory({
                name, icon: newIcon.preset ?? undefined,
                icon_media_id: newIcon.mediaId ?? undefined,
              }), "Category created").finally(() => { setNewName(""); setNewIcon({ preset: null, mediaId: null }); });
            }}
          >
            {busyKey === "create-cat" ? <BusySpinner /> : <Plus className="size-3.5" />} Create
          </button>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </div>

      {data.items.map((category) => {
        const subs = data.subcategories[category.id] ?? [];
        return (
          <div key={category.id} className="admin-card admin-span2">
            <div className="admin-inline-row">
              <span className="admin-cat-glyph">
                <CategoryGlyph icon={category.icon ?? null} url={assetUrl(category.icon_url) ?? null} />
              </span>
              <strong>{category.name}</strong>
              {category.is_hidden && <span className="admin-chip admin-chip-muted">Hidden</span>}
              <span className="admin-chip admin-chip-muted">{category.post_count ?? 0} posts</span>
              <span className="admin-row-actions">
                <button className="admin-input admin-btn" title="Rename / change icon"
                  onClick={() => openEdit(category)}>
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button className="admin-input admin-btn" title="Create subcategory"
                  onClick={() => openSubCreate(category)}>
                  <FolderPlus className="size-3.5" /> Subcategory
                </button>
                <button className="admin-input admin-btn" title={category.is_hidden ? "Show category" : "Hide category"}
                  disabled={busyKey !== null}
                  onClick={() => run(`hide-${category.id}`, () => adminService.updateCategory(category.id, { is_hidden: !category.is_hidden }), category.is_hidden ? "Category is visible again" : "Category hidden")}>
                  {busyKey === `hide-${category.id}` ? <BusySpinner /> : category.is_hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
                {user?.role === "super_admin" && (
                  <button className="admin-input admin-btn danger" title="Delete category"
                    onClick={() => setDeleteCat(category)}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            </div>
            {subs.length > 0 && (
              <div className="admin-subs">
                {subs.map((sub) => (
                  <span key={sub.id} className="admin-chip admin-chip-sub">
                    <CategoryGlyph icon={sub.icon ?? null} url={assetUrl(sub.icon_url) ?? null} />
                    {sub.name}
                    <small>{sub.post_count ?? 0}</small>
                    <button type="button" title="Edit subcategory" onClick={() => openSubEdit(sub)}><Pencil className="size-3" /></button>
                    <button type="button" title="Delete subcategory" disabled={busyKey !== null}
                      onClick={() => run(`del-sub-${sub.id}`, () => adminService.deleteSubcategory(sub.id), "Subcategory deleted")}>
                      {busyKey === `del-sub-${sub.id}` ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editCat && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditCat(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit “{editCat.name}”</DialogTitle></DialogHeader>
            <label className="admin-dialog-field">Name
              <input className="admin-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <div className="admin-dialog-field">Icon
              <IconPicker draft={editIcon} onChange={setEditIcon} busyKey={busyKey} busyId="edit-cat-icon" onUpload={(f) => uploadIcon(f, "edit-cat-icon", setEditIcon)} />
            </div>
            <label className="admin-dialog-check">
              <input type="checkbox" checked={editHidden} onChange={(e) => setEditHidden(e.target.checked)} />
              Hidden from members
            </label>
            <DialogFooter>
              <button className="admin-input admin-btn" onClick={() => setEditCat(null)}>Cancel</button>
              <button className="admin-input admin-btn"
                disabled={busyKey !== null || !editName.trim()}
                onClick={() => run("edit-cat", () => adminService.updateCategory(editCat.id, {
                  name: editName.trim(),
                  icon: editIcon.mediaId ? undefined : (editIcon.preset ?? undefined),
                  icon_media_id: editIcon.mediaId ?? undefined,
                  is_hidden: editHidden,
                }), "Category updated").then(() => setEditCat(null))}>
                {busyKey === "edit-cat" ? <BusySpinner /> : null} Save
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {subTarget && (
        <Dialog open onOpenChange={(open) => { if (!open) setSubTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>New subcategory in “{subTarget.name}”</DialogTitle></DialogHeader>
            <label className="admin-dialog-field">Name
              <input className="admin-input" value={subName} onChange={(e) => setSubName(e.target.value)} />
            </label>
            <div className="admin-dialog-field">Icon
              <IconPicker draft={subIcon} onChange={setSubIcon} busyKey={busyKey} busyId="new-sub-icon" onUpload={(f) => uploadIcon(f, "new-sub-icon", setSubIcon)} />
            </div>
            <DialogFooter>
              <button className="admin-input admin-btn" onClick={() => setSubTarget(null)}>Cancel</button>
              <button className="admin-input admin-btn"
                disabled={busyKey !== null || !subName.trim()}
                onClick={() => run("new-sub", () => adminService.createSubcategory(subTarget.id, {
                  name: subName.trim(),
                  icon: subIcon.mediaId ? undefined : (subIcon.preset ?? undefined),
                  icon_media_id: subIcon.mediaId ?? undefined,
                }), "Subcategory created").then(() => setSubTarget(null))}>
                {busyKey === "new-sub" ? <BusySpinner /> : <Plus className="size-3.5" />} Create
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {subEdit && (
        <Dialog open onOpenChange={(open) => { if (!open) setSubEdit(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit “{subEdit.name}”</DialogTitle></DialogHeader>
            <label className="admin-dialog-field">Name
              <input className="admin-input" value={subEditName} onChange={(e) => setSubEditName(e.target.value)} />
            </label>
            <div className="admin-dialog-field">Icon
              <IconPicker draft={subEditIcon} onChange={setSubEditIcon} busyKey={busyKey} busyId="edit-sub-icon" onUpload={(f) => uploadIcon(f, "edit-sub-icon", setSubEditIcon)} />
            </div>
            <DialogFooter>
              <button className="admin-input admin-btn" onClick={() => setSubEdit(null)}>Cancel</button>
              <button className="admin-input admin-btn"
                disabled={busyKey !== null || !subEditName.trim()}
                onClick={() => run("edit-sub", () => adminService.updateSubcategory(subEdit.id, {
                  name: subEditName.trim(),
                  icon: subEditIcon.mediaId ? undefined : (subEditIcon.preset ?? undefined),
                  icon_media_id: subEditIcon.mediaId ?? undefined,
                }), "Subcategory updated").then(() => setSubEdit(null))}>
                {busyKey === "edit-sub" ? <BusySpinner /> : null} Save
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={deleteCat !== null}
        onOpenChange={(open) => { if (!open) setDeleteCat(null); }}
        title={`Delete “${deleteCat?.name ?? ""}”?`}
        description="This cannot be undone. Categories with posts must be emptied first."
        confirmLabel="Delete"
        pending={busyKey === "delete-cat"}
        onConfirm={() => {
          if (!deleteCat) return;
          void run("delete-cat", () => adminService.deleteCategory(deleteCat.id), "Category deleted").then(() => setDeleteCat(null));
        }}
      />
    </div>
  );
}

function SiteTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-site"], queryFn: adminService.getSiteSettings });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftSocials, setDraftSocials] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  // Local preview of a freshly uploaded image; it only goes live when saved.
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  useEffect(() => () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); }, [pendingPreview]);

  const save = useMutation({
    mutationFn: (values: Record<string, string | Record<string, string>>) => {
      return adminService.putSiteSettings(values);
    },
    onSuccess: async (fresh) => {
      queryClient.setQueryData(["admin-site"], fresh);
      setDraft({});
      setDraftSocials({});
      setPendingPreview(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-site"] }),
        queryClient.invalidateQueries({ queryKey: ["site"] }),
      ]);
      toast.success("Site settings saved");
    },
    onError: (error) => toast.error(errText(error, "Could not save settings")),
  });

  if (query.isLoading) return <LoadingSpinner />;
  const saved = (query.data ?? {}) as Record<string, string | null | undefined> & { site_socials?: Record<string, string> };
  const settings: Record<string, string | null | undefined> = { ...saved, ...draft };
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  // site_socials is the one nested (non-string) field — kept in its own draft
  // slot rather than the flat `draft` map, then merged into the save payload
  // alongside everything else.
  const socialsDraft: Record<string, string> = { ...(saved.site_socials ?? {}), ...draftSocials };
  const setSocial = (key: string, value: string) => setDraftSocials((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(draft).length > 0 || Object.keys(draftSocials).length > 0;

  // One image everywhere: beside the name, browser tab icon, and social preview.
  const savedImage = assetUrl(saved["site_logo_url"] ?? saved["site_favicon_url"] ?? saved["site_og_url"] ?? null) ?? null;
  const siteImage = pendingPreview ?? savedImage;

  async function uploadImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const media = await adminService.uploadMedia(file);
      setPendingPreview(URL.createObjectURL(file));
      setDraft((current) => ({
        ...current,
        site_logo_media_id: media.id,
        site_favicon_media_id: media.id,
        site_og_media_id: media.id,
      }));
      toast.success("Image ready. Press Save settings to publish it.");
    } catch (error) {
      toast.error(errText(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  const val = (key: string, fallback = "") => settings[key] ?? fallback;

  return (
    <div className="admin-grid">
      <div className="admin-media-card admin-span2">
        <span className="admin-media-preview">
          {siteImage ? <img src={siteImage} alt="Site image" /> : <span className="admin-media-empty">No image yet</span>}
        </span>
        <div className="admin-media-fields">
          <strong>Site image{pendingPreview ? " (not saved yet)" : ""}</strong>
          <p>Shown beside the site name, as the browser tab icon, and as the social share preview. One upload covers all three.</p>
          <label className="admin-upload">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
              disabled={uploading}
              onChange={(e) => { void uploadImage(e.target.files?.[0] ?? null); e.target.value = ""; }}
            />
            <span className="admin-input admin-btn" aria-hidden="true">
              {uploading ? <BusySpinner /> : <ImagePlus className="size-3.5" />}
              {uploading ? "Uploading…" : siteImage ? "Replace image" : "Upload image"}
            </span>
          </label>
        </div>
      </div>

      <label>Site name
        <input className="admin-input" value={val("site_name")} onChange={(e) => set("site_name", e.target.value)} />
      </label>
      <label>Currency
        <input className="admin-input" value={val("site_currency")} onChange={(e) => set("site_currency", e.target.value)} />
      </label>
      <label className="admin-span2">Footer text
        <input className="admin-input" value={val("site_footer")} onChange={(e) => set("site_footer", e.target.value)} />
      </label>
      <label className="admin-span2">Site description
        <textarea className="admin-input" rows={2} value={val("site_description")} onChange={(e) => set("site_description", e.target.value)} />
      </label>
      <label className="admin-span2">Keywords
        <input className="admin-input" value={val("site_keywords")} onChange={(e) => set("site_keywords", e.target.value)} />
      </label>
      <label>Site mode
        <ThemeSelect ariaLabel="Site mode" value={val("site_mode", "production") || "production"} onChange={(v) => set("site_mode", v)}
          options={[{ value: "production", label: "Production" }, { value: "maintenance", label: "Maintenance" }]} />
      </label>
      <label>Registration
        <ThemeSelect ariaLabel="Registration" value={val("registration_open", "true") || "true"} onChange={(v) => set("registration_open", v)}
          options={[{ value: "true", label: "Open" }, { value: "false", label: "Closed" }]} />
      </label>
      <label>Social preview title
        <input className="admin-input" value={val("og_title")} onChange={(e) => set("og_title", e.target.value)} />
      </label>
      <label>Social preview description
        <input className="admin-input" value={val("og_description")} onChange={(e) => set("og_description", e.target.value)} />
      </label>

      <div className="admin-span2">
        <strong className="text-xs font-semibold uppercase text-muted-foreground">Social links</strong>
        <p className="mt-1 text-xs text-muted-foreground">Shown as icons in the site footer. Leave a field blank to hide that icon.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SITE_SOCIAL_PLATFORMS.map(({ key, label, icon: Icon }) => (
            <label key={key} className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <input
                className="admin-input"
                placeholder={`${label} URL`}
                value={socialsDraft[key] ?? ""}
                onChange={(e) => setSocial(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="admin-span2 flex flex-wrap gap-2">
        <button
          className="admin-input admin-btn"
          disabled={!dirty || save.isPending || uploading}
          onClick={() => save.mutate(Object.keys(draftSocials).length > 0 ? { ...draft, site_socials: socialsDraft } : draft)}
        >
          {save.isPending ? <BusySpinner /> : <Wrench className="size-3.5" />}
          Save settings
        </button>
        {dirty && (
          <button className="admin-input admin-btn" disabled={save.isPending} onClick={() => { setDraft({}); setDraftSocials({}); setPendingPreview(null); }}>
            <X className="size-3.5" /> Discard changes
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Ads ────────────────────────────────────────────────────────────────────── */

const EMPTY_AD = { media_id: "", preview_url: "", media_type: "image" as "image" | "video", description: "", url: "", sort_order: 0 };

function AdsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-ads"], queryFn: adminService.listAds });
  const [draft, setDraft] = useState(EMPTY_AD);
  const [uploading, setUploading] = useState(false);
  const [busyAd, setBusyAd] = useState<string | null>(null);
  const [deleteAd, setDeleteAd] = useState<AdSlide | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    void queryClient.invalidateQueries({ queryKey: ["site"] });
  };

  const publish = useMutation({
    mutationFn: (body: Parameters<typeof adminService.createAd>[0]) => adminService.createAd(body),
    onSuccess: () => {
      refresh();
      toast.success("Ad posted");
      setDraft(EMPTY_AD);
    },
    onError: (error) => toast.error(errText(error, "Could not post the ad")),
  });

  const runAd = async (key: string, fn: () => Promise<unknown>, successMsg = "Saved") => {
    if (busyAd) return;
    setBusyAd(key);
    try {
      await fn();
      refresh();
      toast.success(successMsg);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setBusyAd(null);
    }
  };

  const ads: AdSlide[] = query.data?.items ?? [];
  const activeCount = ads.filter((ad) => ad.is_active).length;

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const media = await adminService.uploadMedia(file);
      setDraft((current) => ({
        ...current,
        media_id: media.id,
        preview_url: media.url,
        media_type: media.kind === "video" ? "video" : "image",
      }));
      toast.success("Media uploaded — fill in the details and post the ad");
    } catch (error) {
      toast.error(errText(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  const confirmDelete = async () => {
    if (!deleteAd) return;
    setDeletePending(true);
    try {
      await adminService.deleteAd(deleteAd.id);
      refresh();
      toast.success("Ad slide deleted");
      setDeleteAd(null);
    } catch (error) {
      toast.error(errText(error, "Action failed"));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div>
      <form
        className="mb-6 grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.media_id) { toast.error("Upload an image or video first"); return; }
          if (activeCount >= 5) { toast.error("At most 5 active ad slides are allowed"); return; }
          publish.mutate({
            media_id: draft.media_id,
            media_type: draft.media_type,
            description: draft.description,
            url: draft.url || null,
            sort_order: draft.sort_order,
          });
        }}
      >
        <label className="admin-upload">
          <input type="file" accept="image/*,video/mp4,video/webm" disabled={uploading || publish.isPending} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} aria-label="Ad media" />
          <span className="admin-input admin-btn w-fit" aria-hidden="true">
            {uploading ? <BusySpinner /> : <ImagePlus className="size-3.5" />}
            {uploading ? "Uploading…" : draft.media_id ? "Replace media" : "Choose image or video"}
          </span>
        </label>
        <input className="admin-input" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} />
        <input className="admin-input" placeholder="Visit URL (https://…)" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        <input className="admin-input" type="number" min={0} placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
        {draft.media_id && draft.preview_url && (
          <div className="admin-ad-preview sm:col-span-2">
            {draft.media_type === "video"
              ? <video src={draft.preview_url} muted controls preload="metadata" />
              : <img src={draft.preview_url} alt="Ad media preview" />}
            <span className="text-xs text-muted-foreground">Ready to publish</span>
          </div>
        )}
        <button type="submit" className="admin-input admin-btn" disabled={uploading || publish.isPending || !draft.media_id}>
          {publish.isPending ? <BusySpinner /> : <Plus className="size-3.5" />}
          {publish.isPending ? "Posting…" : draft.media_id ? "Post ad" : "Post ad (upload media first)"}
        </button>
      </form>

      <ul className="admin-user-list">
        {ads.map((ad) => (
          <li key={ad.id} className="admin-user-row">
            <div className="flex min-w-0 items-center gap-3">
              {ad.media_url && ad.media_type === "image" && <img src={assetUrl(ad.media_url)} alt="" className="h-10 w-16 rounded object-cover" />}
              <div className="min-w-0">
                <strong className="block truncate text-sm">{ad.description || "(no description)"}</strong>
                <small className="text-xs text-muted-foreground">{ad.media_type} · #{ad.sort_order} · {ad.is_active ? "active" : "hidden"}{ad.url ? ` · ${ad.url}` : ""}</small>
              </div>
            </div>
            <div className="admin-actions">
              <button
                disabled={busyAd === `toggle:${ad.id}`}
                onClick={() => runAd(`toggle:${ad.id}`, () => adminService.updateAd(ad.id, { is_active: !ad.is_active }), ad.is_active ? "Slide hidden" : "Slide shown")}
              >
                {busyAd === `toggle:${ad.id}` ? <BusySpinner /> : null}{ad.is_active ? "Hide" : "Show"}
              </button>
              <button
                className="danger"
                title="Delete ad slide"
                disabled={busyAd === `delete:${ad.id}`}
                onClick={() => setDeleteAd(ad)}
              >
                {busyAd === `delete:${ad.id}` ? <BusySpinner /> : <Trash2 className="size-3.5" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!query.isLoading && ads.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No ad</p>}
      <p className="mt-4 text-xs text-muted-foreground">Visitors see the ad carousel first: slides auto-advance, videos play muted and advance when they finish, and it loops back around.</p>
      <ConfirmDialog
        open={deleteAd !== null}
        onOpenChange={(open) => { if (!open) setDeleteAd(null); }}
        title="Delete this ad slide?"
        description="Visitors will no longer see it in the carousel."
        confirmLabel="Delete slide"
        danger
        pending={deletePending}
        onConfirm={confirmDelete}
      />
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
