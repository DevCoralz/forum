import { Menu, LogOut, Search, Settings, X, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/common/brand-mark";
import { useAuth } from "@/hooks/use-auth";
import { useSite } from "@/hooks/use-site";

export function SiteHeader() {
  const { user, status, signOut } = useAuth();
  const { siteName, settings } = useSite();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = user?.role === "admin" || user?.role === "super_admin";

  async function handleSignOut() {
    try {
      await signOut();
      setMenuOpen(false);
      navigate({ to: "/" });
    } catch {
      /* signing out locally is enough */
    }
  }

  return (
    <>
      {user?.is_flagged && (
        <div className="status-banner status-banner-flag" role="status">
          <TriangleAlert className="size-3.5" />
          <span>Staff has flagged your account{user.flag_reason ? ` — ${user.flag_reason}` : ""}. Be careful.</span>
        </div>
      )}
      {user?.is_suspended && (
        <div className="status-banner status-banner-suspend" role="status">
          <TriangleAlert className="size-3.5" />
          <span>Your account is suspended{user.suspend_reason ? ` — ${user.suspend_reason}` : ""}. You cannot view or interact with threads.</span>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/60 backdrop-blur-2xl">
        <div className="relative mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="min-w-0"><BrandMark name={siteName} logoUrl={settings.site_logo_url} /></Link>
          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <label className="hidden h-9 w-60 items-center gap-2 rounded-full border border-white/85 bg-white/60 px-3 shadow-sm xl:flex">
              <Search className="size-4 text-muted-foreground" />
              <input className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" placeholder="Search tools, accounts..." aria-label="Search tools and categories" />
            </label>
            {user && (
              <Button asChild variant="ghost" size="icon" className="hidden rounded-2xl text-muted-foreground md:inline-flex">
                <Link to="/settings" aria-label="Settings"><Settings /></Link>
              </Button>
            )}
            {user ? (
              <Button variant="ghost" size="sm" className="hidden rounded-2xl text-muted-foreground md:inline-flex" onClick={handleSignOut} aria-label="Log out"><LogOut /></Button>
            ) : (
              <Button asChild variant="coralz" size="sm" className="rounded-2xl" disabled={status === "loading"}><Link to="/login">Login</Link></Button>
            )}
            <Button variant="ghost" size="icon" className="rounded-2xl" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
          {menuOpen && (
            <nav className="page-menu" aria-label="Page navigation">
              <a href="/" onClick={() => setMenuOpen(false)}>Home</a>
              <a href="/#categories" onClick={() => setMenuOpen(false)}>Categories</a>
              <a href="/#latest" onClick={() => setMenuOpen(false)}>Latest items</a>
              {user && (
                isStaff
                  ? <Link to="/write" onClick={() => setMenuOpen(false)}>Share a tool</Link>
                  : <Link to="/share" onClick={() => setMenuOpen(false)}>Share a tool</Link>
              )}
              {user && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
              {isStaff && <Link to="/admin" onClick={() => setMenuOpen(false)} className="admin-menu-link">Admin</Link>}
              {user ? <button onClick={handleSignOut}>Log out</button> : <Link to="/signup" onClick={() => setMenuOpen(false)}>Register</Link>}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
