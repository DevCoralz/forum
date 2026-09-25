import { BrandMark } from "@/components/common/brand-mark";

export function SiteFooter() {
  return (
    <footer id="about" className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="footer-band"><BrandMark /><div className="footer-points"><span>Forum</span><span>Rules</span><span>Contact</span></div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[.68rem] text-muted-foreground"><span>© 2026 I2P Forum</span><span>Terms · Privacy</span></div>
      </div>
    </footer>
  );
}