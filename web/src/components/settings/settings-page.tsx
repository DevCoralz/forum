import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Bell, Check, Crown, Laptop, LockKeyhole, MessageCircle, MonitorSmartphone, Save, Shield, UserRound, UsersRound } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SiteFooter } from "@/components/layout/site-footer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SiteHeader } from "@/components/navigation/site-header";
import { profilesService } from "@/services/profiles";
import { ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import type { PrivacyPreferences, SocialLink } from "@/types/community";

type SettingsView = "profile" | "security" | "privacy" | "subscription";

const navItems = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Security", icon: Shield },
  { id: "privacy", label: "Privacy", icon: LockKeyhole },
  { id: "subscription", label: "Subscription", icon: Crown },
] as const;

function explainApiError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return "Your session expired — log in again to save changes.";
  if (error instanceof ApiError && error.status === 409) return "That username is already taken.";
  return "That change could not be saved. Please try again.";
}

export function SettingsPage() {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<SettingsView>("profile");

  useEffect(() => {
    if (status === "signedOut") navigate({ to: "/login" });
  }, [status, navigate]);

  if (status !== "signedIn" || !user) {
    return (
      <div className="profile-shell">
        <SiteHeader />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="profile-shell">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-6">
          <div className="min-w-0">
            <p className="text-[.68rem] font-semibold uppercase text-primary">Your account</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-3xl">Settings</h1>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Manage your I2P Forum identity, security, privacy, and access.</p>
          </div>
          <Button asChild variant="coralzOutline" size="sm"><Link to="/profile/$username" params={{ username: user.username }}>View profile</Link></Button>
        </div>

        <div className="grid gap-7 py-7 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
          <nav className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0" aria-label="Settings sections">
            <div className="settings-nav">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} data-active={view === id} onClick={() => setView(id)}><Icon className="size-4 shrink-0" />{label}</button>
              ))}
            </div>
          </nav>
          <div className="min-w-0">
            {view === "profile" && <ProfileSettings />}
            {view === "security" && <SecuritySettings />}
            {view === "privacy" && <PrivacySettings />}
            {view === "subscription" && <SubscriptionSettings />}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h2 className="font-display text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>;
}

function ProfileSettings() {
  const { user, refresh } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["profile", user?.username],
    queryFn: () => profilesService.getByUsername(user!.username),
    enabled: Boolean(user),
  });
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<SocialLink[]>([
    { platform: "discord", value: "" },
    { platform: "telegram", value: "" },
    { platform: "website", value: "" },
  ]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const profile = profileQuery.data;
    if (profile && !initialized) {
      setUsername(profile.username);
      setBio(profile.bio);
      setSocials(profile.socials);
      setInitialized(true);
    }
  }, [profileQuery.data, initialized]);

  const wordCount = useMemo(() => bio.trim() ? bio.trim().split(/\s+/).length : 0, [bio]);

  function updateSocial(platform: SocialLink["platform"], value: string) {
    setSocials((current) => current.map((social) => social.platform === platform ? { ...social, value } : social));
  }

  const saveMutation = useMutation({
    mutationFn: () => profilesService.updateMine({ username, bio, socials }),
    onSuccess: async () => {
      toast.success("Profile saved.");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => toast.info(explainApiError(error)),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => profilesService.uploadAvatar(file),
    onSuccess: async () => {
      toast.success("Photo updated.");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.info("That photo could not be uploaded. Try a smaller JPG or PNG."),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (wordCount > 40) {
      toast.error("Premium bios can contain up to 40 words.");
      return;
    }
    saveMutation.mutate();
  }

  const initials = (username || user?.username || "U").slice(0, 2).toUpperCase();
  const avatarUrl = profileQuery.data?.avatarUrl;

  return (
    <form onSubmit={submit}>
      <SectionHeading title="Profile" description="Choose how your identity appears across posts and conversations." />
      <div className="settings-section mt-5">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="profile-avatar size-20 text-base">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" /> : initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Profile picture</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to a few megabytes.</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) avatarMutation.mutate(file);
              e.target.value = "";
            }} />
            <Button type="button" variant="coralzOutline" size="sm" className="mt-3" disabled={avatarMutation.isPending} onClick={() => fileRef.current?.click()}>
              {avatarMutation.isPending ? "Uploading…" : "Change photo"}
            </Button>
          </div>
        </div>
      </div>
      <div className="settings-section grid gap-5 sm:grid-cols-2">
        <label className="settings-field"><Label htmlFor="username">Username</Label><Input id="username" className="settings-input" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <div className="settings-field"><Label>Account badges</Label><div className="flex h-9 items-center gap-2">
          {profileQuery.data?.verified && <BadgeCheck className="size-4 text-cyan" />}
          {profileQuery.data?.tier === "premium" && <span className="premium-badge"><Crown /> Premium</span>}
          {profileQuery.data?.labels.map((label) => <span key={label} className="identity-label">{label}</span>)}
        </div></div>
        <label className="settings-field sm:col-span-2"><span className="flex items-center justify-between gap-3"><Label htmlFor="bio">About me</Label><span className="text-[.68rem] text-muted-foreground">{wordCount}/40 words</span></span><Textarea id="bio" className="settings-input min-h-28 resize-y" value={bio} onChange={(event) => setBio(event.target.value)} /></label>
      </div>
      <div className="settings-section">
        <h3 className="text-sm font-medium text-foreground">Social links</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {socials.map((social) => <label key={social.platform} className="settings-field"><Label htmlFor={social.platform} className="capitalize">{social.platform}</Label><Input id={social.platform} className="settings-input" value={social.value} onChange={(event) => updateSocial(social.platform, event.target.value)} /></label>)}
        </div>
      </div>
      <div className="flex justify-end pt-5"><Button type="submit" variant="coralz" disabled={saveMutation.isPending}><Save /> {saveMutation.isPending ? "Saving…" : "Save changes"}</Button></div>
    </form>
  );
}

function SecuritySettings() {
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: profilesService.listSessions,
  });
  const queryClient = useQueryClient();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      toast.error("The two passwords don't match.");
      return;
    }
    try {
      await profilesService.changePassword(String(data.get("currentPassword")), newPassword);
      toast.success("Password changed.");
      form.reset();
    } catch (error) {
      toast.info(explainApiError(error));
    }
  }

  async function revoke(id: string) {
    try {
      await profilesService.revokeSession(id);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      toast.info(explainApiError(error));
    }
  }

  const sessions = sessionsQuery.data ?? [];

  return (
    <div>
      <SectionHeading title="Security" description="Update your password and review where your account is signed in." />
      <form onSubmit={submit} className="settings-section mt-5 grid gap-4 sm:grid-cols-2">
        <label className="settings-field sm:col-span-2"><Label htmlFor="currentPassword">Current password</Label><Input id="currentPassword" name="currentPassword" type="password" className="settings-input" autoComplete="current-password" required /></label>
        <label className="settings-field"><Label htmlFor="newPassword">New password</Label><Input id="newPassword" name="newPassword" type="password" className="settings-input" autoComplete="new-password" minLength={8} required /></label>
        <label className="settings-field"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" name="confirmPassword" type="password" className="settings-input" autoComplete="new-password" minLength={8} required /></label>
        <div className="sm:col-span-2"><Button type="submit" variant="coralz"><LockKeyhole /> Change password</Button></div>
      </form>
      <div className="settings-section">
        <h3 className="text-sm font-medium text-foreground">Signed-in sessions</h3>
        <div className="mt-3">
          {sessionsQuery.isLoading && <LoadingSpinner className="py-3" />}
          {sessions.map((session) => <div key={session.id} className="settings-row"><div className="flex min-w-0 items-center gap-3"><Laptop className="size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{session.device} {session.current && <span className="ml-1 text-primary">Current</span>}</p><p className="mt-1 truncate text-[.68rem] text-muted-foreground">{session.location} · {session.lastActive}</p></div></div>{!session.current && <Button variant="ghost" size="sm" onClick={() => revoke(session.id)}>Revoke</Button>}</div>)}
          {!sessionsQuery.isLoading && sessions.length === 0 && <p className="py-3 text-xs text-muted-foreground">No session</p>}
        </div>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const privacyQuery = useQuery({
    queryKey: ["privacy"],
    queryFn: profilesService.getPrivacy,
  });
  const [privacy, setPrivacy] = useState<PrivacyPreferences | null>(null);
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  useEffect(() => {
    if (privacyQuery.data && !loadedFromServer) {
      setPrivacy(privacyQuery.data);
      setLoadedFromServer(true);
    }
  }, [privacyQuery.data, loadedFromServer]);

  async function save() {
    if (!privacy) return;
    try {
      const saved = await profilesService.updatePrivacy(privacy);
      setPrivacy(saved);
      toast.success("Privacy settings saved.");
    } catch (error) {
      toast.info(explainApiError(error));
    }
  }

  if (!privacy) {
    return (
      <div>
        <SectionHeading title="Privacy" description="Control who can view your profile and interact with you." />
        {privacyQuery.isLoading ? <LoadingSpinner className="py-3" /> : <p className="settings-section mt-5 text-xs text-muted-foreground">Privacy settings could not be loaded.</p>}
      </div>
    );
  }

  return (
    <div>
      <SectionHeading title="Privacy" description="Control who can view your profile and interact with you." />
      <div className="settings-section mt-5">
        <label className="settings-field"><Label>Profile visibility</Label><Select value={privacy.profileVisibility} onValueChange={(value: "public" | "premium") => setPrivacy((current) => current && ({ ...current, profileVisibility: value }))}><SelectTrigger className="settings-input max-w-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="premium">Premium members and admins</SelectItem></SelectContent></Select><span className="text-[.68rem] text-muted-foreground">Free members remain public. Premium members can restrict their profile.</span></label>
      </div>
      <div className="settings-section">
        <PrivacyRow icon={MessageCircle} title="Comments on my posts" description="Allow members with access to reply to your posts." checked={privacy.allowComments} onCheckedChange={(checked) => setPrivacy((current) => current && ({ ...current, allowComments: checked }))} />
        <PrivacyRow icon={Bell} title="Mentions" description="Allow members to mention you in posts and comments." checked={privacy.allowMentions} onCheckedChange={(checked) => setPrivacy((current) => current && ({ ...current, allowMentions: checked }))} />
        <PrivacyRow icon={UsersRound} title="Direct messages" description="Allow private messages from community members." checked={privacy.allowDirectMessages} onCheckedChange={(checked) => setPrivacy((current) => current && ({ ...current, allowDirectMessages: checked }))} />
      </div>
      <div className="settings-section"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div><h3 className="text-sm font-medium text-foreground">Blocked accounts</h3><p className="mt-1 text-xs text-muted-foreground">You have not blocked any accounts.</p></div><Button variant="coralzOutline" size="sm">Manage</Button></div></div>
      <div className="flex justify-end pt-5"><Button variant="coralz" onClick={save}><Save /> Save privacy</Button></div>
    </div>
  );
}

function PrivacyRow({ icon: Icon, title, description, checked, onCheckedChange }: { icon: typeof MessageCircle; title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="settings-row"><div className="flex min-w-0 gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-medium text-foreground">{title}</p><p className="mt-1 text-[.68rem] leading-5 text-muted-foreground">{description}</p></div></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} /></div>;
}

function SubscriptionSettings() {
  const subscriptionQuery = useQuery({
    queryKey: ["subscription"],
    queryFn: profilesService.getSubscription,
  });
  const subscription = subscriptionQuery.data;
  const isPremium = subscription?.tier === "premium" && subscription.status === "active";

  return (
    <div>
      <SectionHeading title="Subscription" description="Review the premium access assigned to your account." />
      <div className="settings-section mt-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Crown className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-base font-semibold text-foreground">{isPremium ? "Premium member" : "Free member"}</h3><span className="premium-badge"><Check /> {subscription?.status === "active" ? "Active" : "Inactive"}</span></div><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Premium posts, protected resources, publishing access when authorized, and additional privacy controls.</p></div></div>
          {subscription?.renewsAt && <span className="text-xs text-muted-foreground">Renews {subscription.renewsAt}</span>}
        </div>
      </div>
      <div className="settings-section">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div><p className="text-sm font-medium text-foreground">Access management</p><p className="mt-1 text-xs text-muted-foreground">Premium status is managed by I2P Forum administrators.</p></div><MonitorSmartphone className="size-5 text-primary" /></div>
      </div>
      <div className="mt-5 border-l-2 border-primary/50 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">There are no prices on individual posts. Your account access determines which posts you can open.</div>
    </div>
  );
}
