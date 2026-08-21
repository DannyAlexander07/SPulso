import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/api";

const sessionMaxAge = 60 * 60 * 8;

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  const response = await fetch(`${API_URL}/auth/login`, {
    body: JSON.stringify(payload),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.accessToken) {
    return NextResponse.json(
      body ?? { message: "No se pudo iniciar sesion." },
      { status: response.status || 401 },
    );
  }

  const { accessToken, ...safeBody } = body;
  const nextResponse = NextResponse.json(safeBody);
  nextResponse.cookies.set("spulso_token", accessToken, {
    httpOnly: true,
    maxAge: sessionMaxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return nextResponse;
}
