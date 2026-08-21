import { API_URL, authHeaders } from "@/lib/api";
import type { AuthUser, LoginResponse } from "./types";

export async function login(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo iniciar sesión.");
  }

  return response.json() as Promise<LoginResponse>;
}

export async function getCurrentUser(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      cache: "no-store",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<AuthUser>;
  } catch {
    return null;
  }
}
