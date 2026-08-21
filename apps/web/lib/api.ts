export const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const BROWSER_API_URL = "/api/spulso";

export function getApiUrl() {
  return typeof window === "undefined" ? API_URL : BROWSER_API_URL;
}

export function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clientAuthHeaders(): HeadersInit {
  return {};
}

export async function apiGet<T>(path: string, fallback: T, token?: string | null): Promise<T> {
  try {
    const response = await fetch(`${getApiUrl()}${path}`, {
      cache: "no-store",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      return fallback;
    }

    return response.json();
  } catch {
    return fallback;
  }
}

export function mediaUrl(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("/uploads/")) return `${getApiUrl()}${value}`;
  return value;
}
