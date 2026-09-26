import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_SITE_NAME, siteService, type SiteBootstrap } from "@/services/site";

interface SiteContextValue {
  settings: SiteBootstrap["settings"];
  ads: SiteBootstrap["ads"];
  siteName: string;
  isLoading: boolean;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["site"],
    queryFn: () => siteService.getBootstrap(),
    staleTime: 120_000,
    retry: 2,
  });

  const settings = query.data?.settings ?? {};
  const ads = query.data?.ads ?? [];
  const siteName = settings.site_name?.trim() || DEFAULT_SITE_NAME;

  // Keep the browser tab and share preview in sync with the admin-managed settings.
  // The single "site image" backs the favicon and social image too.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = siteName;
    const favicon = settings.site_favicon_url ?? settings.site_logo_url ?? null;
    if (favicon) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [siteName, settings.site_favicon_url, settings.site_logo_url]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const setMeta = (attribute: string, key: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };
    const image = settings.site_og_url ?? settings.site_logo_url ?? null;
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
    if (settings.og_title) setMeta("property", "og:title", settings.og_title);
    if (settings.og_description) setMeta("property", "og:description", settings.og_description);
  }, [settings.site_og_url, settings.site_logo_url, settings.og_title, settings.og_description]);

  const value = useMemo(
    () => ({ settings, ads, siteName, isLoading: query.isLoading }),
    [settings, ads, siteName, query.isLoading],
  );

  const isStaff = user?.role === "admin" || user?.role === "super_admin";
  const maintenance = !query.isLoading && settings.site_mode === "maintenance" && !isStaff;

  if (maintenance) {
    return (
      <div className="maintenance-screen">
        <span className="brand-mark" aria-hidden="true">I2P</span>
        <h1>{siteName}</h1>
        <p>The site is in maintenance mode. Check back soon.</p>
      </div>
    );
  }

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSite must be used inside <SiteProvider>");
  return context;
}
