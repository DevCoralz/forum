import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { ProfilePage } from "@/components/profiles/profile-page";
import { profilesService } from "@/services/profiles";
import { ApiError } from "@/services/api";
import type { CommunityProfile } from "@/types/community";

async function loadProfile(username: string): Promise<CommunityProfile> {
  try {
    return await profilesService.getByUsername(username);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

export const Route = createFileRoute("/profile/$username")({
  loader: ({ params }) => loadProfile(params.username),
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — CORALZ Profile` },
      { name: "description", content: `View ${params.username}'s community profile and public posts on CORALZ.` },
      { property: "og:title", content: `${params.username} — CORALZ Profile` },
      { property: "og:description", content: `View ${params.username}'s public CORALZ profile and posts.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: ProfileNotFound,
  component: ProfileRoute,
});

function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <p className="p-10 text-center text-sm text-muted-foreground">No member goes by that name.</p>
      <SiteFooter />
    </div>
  );
}

function ProfileRoute() {
  const profile = Route.useLoaderData();
  return <ProfilePage profile={profile} />;
}
