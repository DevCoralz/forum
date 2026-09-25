import { Menu, LogOut, MessageCircle, Moon, PenLine, Search, Settings, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/common/brand-mark";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, status, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", lightMode);
  }, [lightMode]);

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
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:px-8">
        <Link to="/" className="min-w-0"><BrandMark /></Link>
        <nav className="hidden items-center justify-center gap-7 lg:flex" aria-label="Primary navigation">
          <a className="nav-link nav-link-active" href="#top">Home</a>
          <a className="nav-link" href="#categories">Categories</a>
          <a className="nav-link" href="#latest">Latest</a>
        </nav>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <label className="hidden h-9 w-60 items-center gap-2 rounded-full border border-border bg-surface/70 px-3 xl:flex">
            <Search className="size-4 text-muted-foreground" />
            <input className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" placeholder="Search posts, categories..." aria-label="Search posts and categories" />
          </label>
          <Button variant="ghost" size="icon" aria-label="Toggle theme" className="rounded-full text-muted-foreground" onClick={() => setLightMode((value) => !value)}>
            {lightMode ? <Sun /> : <Moon />}
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full text-muted-foreground">
            <Link to="/messages" aria-label="Messages"><MessageCircle /></Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" className="hidden rounded-full text-muted-foreground md:inline-flex">
                <Link to="/profile/$username" params={{ username: user.username }} aria-label="Your profile"><UserRound /></Link>
              </Button>
              {/* Shown to signed-in members; the server re-checks on publish. */}
              <Button asChild variant="coralzOutline" size="sm" className="hidden sm:inline-flex"><Link to="/write"><PenLine />Write</Link></Button>
              <Button asChild variant="ghost" size="icon" className="hidden rounded-full text-muted-foreground md:inline-flex">
                <Link to="/settings" aria-label="Settings"><Settings /></Link>
              </Button>
              <Button variant="ghost" size="sm" className="hidden text-muted-foreground md:inline-flex" onClick={handleSignOut} aria-label="Log out"><LogOut /></Button>
            </>
          ) : (
            <Button asChild variant="coralz" size="sm" disabled={status === "loading"}><Link to="/login">Login</Link></Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full lg:hidden" aria-label="Toggle navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-border bg-background/95 px-4 py-3 lg:hidden">
          <nav className="mx-auto flex max-w-7xl items-center gap-5 text-sm" aria-label="Mobile navigation">
            <a href="#top" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#categories" onClick={() => setMenuOpen(false)}>Categories</a>
            <a href="#latest" onClick={() => setMenuOpen(false)}>Latest</a>
            {user ? (
              <>
                <Link to="/write" className="text-muted-foreground sm:hidden" onClick={() => setMenuOpen(false)}>Write</Link>
                <Link to="/profile/$username" params={{ username: user.username }} className="text-muted-foreground sm:hidden" onClick={() => setMenuOpen(false)}>Profile</Link>
                <button className="ml-auto text-muted-foreground" onClick={handleSignOut}>Log out</button>
              </>
            ) : (
              <Link to="/login" className="ml-auto text-muted-foreground">Login</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
