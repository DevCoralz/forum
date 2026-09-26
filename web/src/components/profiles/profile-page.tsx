import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Crown, Globe, LockKeyhole, MessageCircle, Send, Settings, ShieldCheck } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostFeed } from "@/components/posts/post-feed";
import { postsService } from "@/services/posts";
import { useAuth } from "@/hooks/use-auth";
import type { CommunityProfile } from "@/types/community";

export function ProfilePage({ profile }: { profile: CommunityProfile }) {
  const [activeTab, setActiveTab] = useState<"posts" | "activity">("posts");
  const { user } = useAuth();
  const isSelf = user?.username === profile.username;

  const postsQuery = useQuery({
    queryKey: ["posts", "author", profile.username],
    queryFn: () => postsService.listByAuthor(profile.username),
    staleTime: 30_000,
  });

  return (
    <div className="profile-shell">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <div className="profile-avatar">
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt="" className="size-full rounded-full object-cover" />
                  : profile.initials}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-xl font-semibold text-foreground sm:text-2xl">{profile.username}</h1>
                  {profile.verified && <VerifiedBadge className="size-4" label="Verified member" />}
                  {profile.tier === "premium" && <span className="premium-badge"><Crown /> Premium</span>}
                  {profile.labels.map((label) => <span key={label} className="identity-label">{label}</span>)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            {isSelf && (
              <Button asChild variant="coralzOutline" size="sm" className="mb-1">
                <Link to="/settings"><Settings /> <span className="hidden sm:inline">Edit profile</span></Link>
              </Button>
            )}
          </div>

          <div className="grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0">
              <p className="max-w-2xl text-sm leading-6 text-secondary-foreground">{profile.bio}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Joined {profile.joinedAt}</span>
                {profile.canPublish && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-cyan" /> Approved publisher</span>}
              </div>
              <div className="mt-5 flex gap-6">
                <div className="profile-stat"><strong>{profile.postCount}</strong><span>Threads</span></div>
                <div className="profile-stat"><strong>{profile.followerCount.toLocaleString()}</strong><span>Followers</span></div>
                <div className="profile-stat"><strong>{profile.followingCount}</strong><span>Following</span></div>
              </div>
            </div>

            <aside className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-[.68rem] font-semibold uppercase text-muted-foreground">Links</p>
              <div className="mt-3 grid gap-2 text-xs">
                {profile.socials.filter((social) => social.value).map((social) => (
                  <div key={social.platform} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-secondary-foreground">
                    {social.platform === "website" ? <Globe className="size-3.5 text-primary" /> : social.platform === "telegram" ? <Send className="size-3.5 text-primary" /> : <MessageCircle className="size-3.5 text-primary" />}
                    <span className="truncate">{social.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 flex items-start gap-2 text-[.68rem] leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3 shrink-0" />Followers are private.</p>
            </aside>
          </div>

          <div className="scrollbar-none overflow-x-auto">
            <div className="profile-tabs" role="tablist" aria-label="Profile content">
              <button data-active={activeTab === "posts"} onClick={() => setActiveTab("posts")}>Threads <span className="ml-1 text-muted-foreground">{profile.postCount}</span></button>
              <button data-active={activeTab === "activity"} onClick={() => setActiveTab("activity")}>Activity</button>
            </div>
          </div>
        </section>

        {activeTab === "posts" ? (
          <div className="pt-6"><PostFeed posts={postsQuery.data ?? []} isLoading={postsQuery.isLoading} /></div>
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">No activity</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
