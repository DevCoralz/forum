import { BrandMark } from "@/components/common/brand-mark";
import { useSite } from "@/hooks/use-site";
import { SITE_SOCIAL_PLATFORMS } from "@/lib/site-socials";

export function SiteFooter() {
  const { siteName, settings } = useSite();
  const socials = settings.site_socials ?? {};
  const socialEntries = SITE_SOCIAL_PLATFORMS.filter((p) => socials[p.key]?.trim());
  const footerText = settings.site_footer?.trim() || `© ${new Date().getFullYear()} ${siteName}`;

  return (
    <footer id="about" className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="footer-band">
          <BrandMark name={siteName} logoUrl={settings.site_logo_url} />
          <div className="footer-points"><span>Forum</span><span>Rules</span><span>Contact</span></div>
          {socialEntries.length > 0 && (
            <div className="flex items-center gap-3">
              {socialEntries.map(({ key, label, icon: Icon }) => (
                <a
                  key={key}
                  href={socials[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[.68rem] text-muted-foreground">
          <span>{footerText}</span>
          <span>Terms · Privacy</span>
        </div>
      </div>
    </footer>
  );
}
