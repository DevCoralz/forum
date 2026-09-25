import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/common/brand-mark";
import { useAuth } from "@/hooks/use-auth";
import { signup } from "@/services/auth";
import { ApiError } from "@/services/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && username.trim().length < 3) return setError("Username must be at least 3 characters.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (isSignup) {
        await signup(username.trim(), email.trim(), password);
      }
      await signIn(username.trim(), password);
      // No dashboard: go straight back to exploring.
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setError("Accounts aren't connected yet. The server will be linked soon.");
      else if (err instanceof ApiError && err.status === 401) setError("Wrong username or password.");
      else if (err instanceof ApiError && err.status === 409) setError("That email or username is already taken.");
      else if (err instanceof ApiError && err.status === 403) setError(isSignup ? "Registration is currently closed." : "This account is suspended or unavailable.");
      else if (err instanceof ApiError && err.status === 429) setError("Too many attempts. Please try again in 15 minutes.");
      else if (err instanceof ApiError && err.status === 422) setError("Check the username, email, and password requirements and try again.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-border bg-surface/70 px-3.5 text-sm text-foreground outline-none transition focus:border-primary placeholder:text-muted-foreground";

  return (
    <div className="flex min-h-screen flex-col bg-background px-4">
      <header className="mx-auto flex h-16 w-full max-w-md items-center justify-between">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Keep exploring</Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-16">
        <h1 className="font-display text-3xl font-semibold text-foreground">{isSignup ? "Create an I2P Forum account" : "Log in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup ? "Create an account to view and download full content." : "Log in to unlock posts and items."}
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          {!isSignup && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Username</span>
              <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={30} required />
            </label>
          )}
          {isSignup && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Username</span>
              <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={30} required />
            </label>
          )}
          {isSignup && <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} required />
          </label>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" variant="coralz" className="h-11 w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {isSignup ? "Create account" : "Log in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already a member? " : "New to I2P Forum? "}
          <Link to={isSignup ? "/login" : "/signup"} className="font-medium text-primary hover:underline">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </main>
    </div>
  );
}
