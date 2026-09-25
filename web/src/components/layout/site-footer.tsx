import { ShieldCheck, Users, Zap } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";

export function SiteFooter() {
  return (
    <footer id="about" className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="footer-band">
          <div><BrandMark /><p>More than a platform. A community.</p></div>
          <div className="footer-points"><span><ShieldCheck /> Safe & secure</span><span><Zap /> Fast access</span><span><Users /> Growing community</span></div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[.68rem] text-muted-foreground"><span>© 2026 Coralz. All rights reserved.</span><span>Terms · Privacy · Contact</span></div>
      </div>
    </footer>
  );
}