import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/api";

const hopByHopHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const maxMultipartBytes = 26 * 1024 * 1024;

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return forwardToApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forwardToApi(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forwardToApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forwardToApi(request, context);
}

async function forwardToApi(request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get("spulso_token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const { path } = await context.params;
  const targetUrl = new URL(`${API_URL}/${path.map(encodeURIComponent).join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const init: RequestInit = {
    cache: "no-store",
    headers,
    method: request.method,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      const contentLength = Number(request.headers.get("content-length") ?? 0);

      if (contentLength > maxMultipartBytes) {
        return NextResponse.json(
          { message: "El archivo excede el limite permitido." },
          { status: 413 },
        );
      }

      const authResponse = await fetch(`${API_URL}/auth/me`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!authResponse.ok) {
        return NextResponse.json({ message: "Sesion no valida." }, { status: 401 });
      }

      init.body = request.body;
      (init as RequestInit & { duplex: "half" }).duplex = "half";
    } else {
      const body = await request.text();
      init.body = body.length > 0 ? body : undefined;
    }
  }

  const apiResponse = await fetch(targetUrl, init);
  const responseHeaders = new Headers();

  apiResponse.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(apiResponse.body, {
    headers: responseHeaders,
    status: apiResponse.status,
    statusText: apiResponse.statusText,
  });
}
