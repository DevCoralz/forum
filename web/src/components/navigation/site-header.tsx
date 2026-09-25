import { Menu, LogOut, MessageCircle, PenLine, Search, Settings, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/common/brand-mark";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, status, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-lg">
      <div className="relative mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0"><BrandMark /></Link>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <label className="hidden h-9 w-60 items-center gap-2 rounded-full border border-border bg-surface/70 px-3 xl:flex">
            <Search className="size-4 text-muted-foreground" />
            <input className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" placeholder="Search posts, categories..." aria-label="Search posts and categories" />
          </label>
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
          <Button variant="ghost" size="icon" className="rounded-sm" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
        {menuOpen && (
          <nav className="page-menu" aria-label="Page navigation">
            <a href="/#top" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="/#categories" onClick={() => setMenuOpen(false)}>Categories</a>
            <a href="/#latest" onClick={() => setMenuOpen(false)}>Latest posts</a>
            <Link to="/messages" onClick={() => setMenuOpen(false)}>Messages</Link>
            {user && <Link to="/write" onClick={() => setMenuOpen(false)}>Write post</Link>}
            {user && <Link to="/profile/$username" params={{ username: user.username }} onClick={() => setMenuOpen(false)}>Profile</Link>}
            {user && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
            {user ? <button onClick={handleSignOut}>Log out</button> : <Link to="/signup" onClick={() => setMenuOpen(false)}>Register</Link>}
          </nav>
        )}
      </div>
    </header>
  );
}
