import { apiRequest, setToken } from "@/services/api";

export type BackendRole = "free" | "premium" | "admin" | "super_admin";

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role: BackendRole;
  tier: "free" | "premium";
  is_verified_tick?: boolean;
  about_me?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

/** Premium access is anything above free; admins also see premium content. */
function withTier(user: AuthUser): AuthUser {
  return { ...user, tier: user.role === "free" ? "free" : "premium" };
}

export interface RegistrationResult {
  id: string;
  username: string;
  email: string;
  role: BackendRole;
  created_at: string;
}

export interface LoginResult {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

/**
 * The backend sets an httpOnly session cookie and also returns a bearer token.
 * The cookie is same-site, so cross-origin requests rely on the bearer token.
 */
export async function login(username: string, password: string) {
  const result = await apiRequest<LoginResult>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  setToken(result.access_token);
  return { ...result, user: withTier(result.user) };
}

export function signup(username: string, email: string, password: string) {
  return apiRequest<RegistrationResult>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function me() {
  return withTier(await apiRequest<AuthUser>("/auth/me"));
}

export async function logout() {
  try {
    await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}
