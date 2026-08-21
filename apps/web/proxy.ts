import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/portal/login", "/marcacion", "/cambiar-pin"];
const apiUrl =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";
const sessionCacheTtlMs = 15_000;
const sessionCacheMaxEntries = 500;

type SessionUser = {
  access?: {
    admin?: boolean;
    portal?: boolean;
  };
  employeeId?: string | null;
  permissions?: string[];
  role?: {
    name?: string;
    permissions?: string[];
  } | null;
};

type SessionValidation =
  | { status: "valid"; user: SessionUser }
  | { status: "invalid" }
  | { status: "unavailable" };

const sessionCache = new Map<
  string,
  { expiresAt: number; user: SessionUser }
>();

const routePermissions = [
  { path: "/usuarios", permission: "users.manage" },
  { path: "/empresas", permission: "companies.manage" },
  { path: "/trabajadores", permission: "employees.view" },
  { path: "/asistencia", permission: "attendance.view" },
  { path: "/solicitudes", permission: "requests.view" },
  { path: "/documentos", permission: "documents.view" },
  { path: "/organizacion", permission: "organization.view" },
  { path: "/beneficios", permission: "benefits.view" },
  { path: "/comunicados", permission: "announcements.view" },
  { path: "/notificaciones", permission: "notifications.view" },
  { path: "/automatizaciones", permission: "automations.view" },
  { path: "/auditoria", permission: "audit.view" },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("spulso_token")?.value;
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (pathname === "/portal/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!token && !isPublicPath) {
    const loginPath = pathname.startsWith("/portal") ? "/portal/login" : "/login";

    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (token && (!isPublicPath || pathname === "/login")) {
    const session = await validateSession(token);

    if (session.status === "invalid") {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("spulso_token", "", {
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });

      return response;
    }

    if (session.status === "unavailable") {
      return new NextResponse("Servicio temporalmente no disponible.", {
        headers: { "Retry-After": "5" },
        status: 503,
      });
    }

    const sessionUser = session.user;

    if (pathname === "/login") {
      const destination = getDefaultWorkspacePath(sessionUser);

      return NextResponse.redirect(new URL(destination, request.url));
    }

    if (pathname === "/seleccionar-panel" && !hasBothAccess(sessionUser)) {
      return NextResponse.redirect(new URL(getDefaultWorkspacePath(sessionUser), request.url));
    }

    if (!hasAdminAccess(sessionUser) && isAdminShellPath(pathname)) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    if (pathname.startsWith("/portal") && !hasPortalAccess(sessionUser)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const requiredPermission = getRequiredPermission(pathname);

    if (requiredPermission && !hasPermission(sessionUser, requiredPermission)) {
      const destination = getDefaultWorkspacePath(sessionUser);

      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.next();
}

async function validateSession(token: string) {
  const now = Date.now();
  const cached = sessionCache.get(token);

  if (cached && cached.expiresAt > now) {
    return { status: "valid", user: cached.user } satisfies SessionValidation;
  }

  if (cached) {
    sessionCache.delete(token);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${apiUrl}/auth/me`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "invalid" } satisfies SessionValidation;
    }

    if (!response.ok) {
      return { status: "unavailable" } satisfies SessionValidation;
    }

    const user = (await response.json()) as SessionUser;
    cacheSession(token, user, now);

    return { status: "valid", user } satisfies SessionValidation;
  } catch {
    return { status: "unavailable" } satisfies SessionValidation;
  } finally {
    clearTimeout(timeout);
  }
}

function cacheSession(token: string, user: SessionUser, now: number) {
  if (sessionCache.size >= sessionCacheMaxEntries) {
    for (const [key, value] of sessionCache) {
      if (value.expiresAt <= now || sessionCache.size >= sessionCacheMaxEntries) {
        sessionCache.delete(key);
      }
    }
  }

  sessionCache.set(token, {
    expiresAt: now + sessionCacheTtlMs,
    user,
  });
}

function getRequiredPermission(pathname: string) {
  return routePermissions.find((route) => pathname.startsWith(route.path))?.permission;
}

function hasPermission(user: SessionUser, permission: string) {
  const permissions = user.permissions ?? user.role?.permissions ?? [];

  return permissions.includes(permission);
}

function getDefaultWorkspacePath(user: SessionUser) {
  if (hasAdminAccess(user) && hasPortalAccess(user)) {
    return "/seleccionar-panel";
  }

  if (hasAdminAccess(user)) {
    return "/";
  }

  if (hasPortalAccess(user)) {
    return "/portal";
  }

  return "/login";
}

function hasBothAccess(user: SessionUser) {
  return hasAdminAccess(user) && hasPortalAccess(user);
}

function hasAdminAccess(user: SessionUser) {
  return Boolean(user.access?.admin);
}

function hasPortalAccess(user: SessionUser) {
  return Boolean(user.access?.portal || user.employeeId);
}

function isAdminShellPath(pathname: string) {
  if (pathname.startsWith("/portal") || pathname.startsWith("/marcacion") || pathname.startsWith("/cambiar-pin")) {
    return false;
  }

  return true;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
