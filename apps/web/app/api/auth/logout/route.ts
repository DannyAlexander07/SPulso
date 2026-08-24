import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/api";

export async function POST(request: NextRequest) {
  const configuredOrigin = process.env.WEB_URL?.replace(/\/$/, "");
  const expectedOrigin = configuredOrigin || request.nextUrl.origin;
  const requestOrigin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    (requestOrigin && requestOrigin !== expectedOrigin) ||
    (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
  ) {
    return NextResponse.json(
      { message: "Origen no autorizado para cerrar la sesión.", ok: false },
      { status: 403 },
    );
  }

  const token = request.cookies.get("spulso_token")?.value;
  let revocationConfirmed = !token;

  if (token) {
    try {
      const upstream = await fetch(`${API_URL}/auth/logout`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      });
      revocationConfirmed = upstream.ok || upstream.status === 401;
    } catch {
      revocationConfirmed = false;
    }
  }

  const response = NextResponse.json(
    revocationConfirmed
      ? { ok: true, revoked: true }
      : {
          message:
            "La sesión local se cerró, pero no se pudo confirmar la revocación remota.",
          ok: false,
          revoked: false,
        },
    { status: revocationConfirmed ? 200 : 502 },
  );
  response.cookies.set("spulso_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
