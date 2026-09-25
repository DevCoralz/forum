const configuredApiUrl = import.meta.env["VITE_API_URL"]?.trim();

export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/$/, "") : "";

const TOKEN_KEY = "coralz:token";

let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;
  memoryToken = window.localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function setToken(token: string | null) {
  memoryToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Absolute URL for a path the API returns (avatars, chat images). */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const retryableStatus = (status: number) => status === 502 || status === 503 || status === 504;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError("VITE_API_URL is not configured", 503);
  }

  const versionedPath = `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const method = (init?.method ?? "GET").toUpperCase();
  // Reads are retried so a slow or waking backend never takes a page down with
  // a transient first-request failure. Writes are always sent exactly once.
  const maxAttempts = method === "GET" ? 3 : 1;

  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${versionedPath}`, {
        ...init,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
    } catch {
      if (attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }
      throw new ApiError("Could not reach the server", 503);
    }

    if (!response.ok) {
      if (retryableStatus(response.status) && attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }
      let message = `Request failed with status ${response.status}`;
      try {
        const body = (await response.clone().json()) as { detail?: unknown };
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        /* non-JSON error body */
      }
      if (response.status === 401) setToken(null);
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
