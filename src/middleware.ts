import { NextRequest, NextResponse } from "next/server";

/**
 * §16.2 S1, S3, S4 & §16.3 G5: Edge Middleware
 * - No fallback SESSION_SECRET: refuses requests if SESSION_SECRET is missing or < 32 bytes.
 * - Verifies `<sessionId>.<identityType>.<hmac>` cookie signature.
 * - Blocks unauthenticated `/uploads/*` and `/api/*` requests.
 * - Uses `APP_BASE_URL` for redirects (`G5`).
 */

function getEdgeSessionSecret(): string {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (secret.length < 32) {
    throw new Error(
      "FAIL_CLOSED: SESSION_SECRET is missing or shorter than 32 bytes"
    );
  }
  return secret;
}

function getEdgeBaseUrl(req: NextRequest): string {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error(
      "FAIL_CLOSED: APP_BASE_URL is required when NODE_ENV=production"
    );
  }
  if (configured) return configured;
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

async function verifyCookieEdge(
  token?: string
): Promise<{ sessionId: string; identityType: "coworker" | "partner" } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, identityType, sig] = parts;
  if (
    !sessionId ||
    (identityType !== "coworker" && identityType !== "partner") ||
    !sig
  ) {
    return null;
  }

  const secret = getEdgeSessionSecret();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${sessionId}.${identityType}`)
  );
  const bytes = new Uint8Array(mac);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const expectedSig = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  if (sig !== expectedSig) return null;
  return { sessionId, identityType };
}

export async function middleware(req: NextRequest) {
  // Enforce fail-closed SESSION_SECRET check on every request (S1)
  getEdgeSessionSecret();

  const { pathname } = req.nextUrl;
  const baseUrl = getEdgeBaseUrl(req);

  // Public surfaces that do not require an authenticated session
  // Note: `/uploads` is intentionally NOT public (§16.2 S4)!
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/login" ||
    pathname === "/p/login" ||
    pathname === "/p/activate" ||
    pathname.startsWith("/p/activate/") ||
    pathname.startsWith("/forms/") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public-forms") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/scheduler")
  ) {
    // §3.2 Fresh start: When no admin exists, /login and /p/login redirect to /setup
    if (pathname === "/login" || pathname === "/p/login") {
      try {
        const setupRes = await fetch(`${baseUrl}/api/setup`, {
          cache: "no-store",
        });
        if (setupRes.ok) {
          const setupJson = await setupRes.json();
          if (setupJson?.needsSetup) {
            return NextResponse.redirect(`${baseUrl}/setup`);
          }
        }
      } catch {
        // Proceed if internal check cannot complete during cold start
      }
    }
    return NextResponse.next();
  }

  const cookieVal = req.cookies.get("rprm_session")?.value;
  const session = await verifyCookieEdge(cookieVal);

  // API and file download routes: return 401 JSON if no valid session cookie
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads")) {
    if (!session) {
      return NextResponse.json(
        {
          lookupStatus: "could_not_check",
          error:
            "Authentication required: missing or invalid httpOnly session cookie",
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Partner Portal pages (/p or /portal): require authenticated session
  if (
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  ) {
    if (!session) {
      try {
        const setupRes = await fetch(`${baseUrl}/api/setup`, {
          cache: "no-store",
        });
        if (setupRes.ok) {
          const setupJson = await setupRes.json();
          if (setupJson?.needsSetup) {
            return NextResponse.redirect(`${baseUrl}/setup`);
          }
        }
      } catch {
        // ignore
      }
      return NextResponse.redirect(`${baseUrl}/p/login`);
    }
    return NextResponse.next();
  }

  // Admin pages: require authenticated Coworker session (or redirect to /setup if fresh install)
  if (!session) {
    try {
      const setupRes = await fetch(`${baseUrl}/api/setup`, {
        cache: "no-store",
      });
      if (setupRes.ok) {
        const setupJson = await setupRes.json();
        if (setupJson?.needsSetup) {
          return NextResponse.redirect(`${baseUrl}/setup`);
        }
      }
    } catch {
      // ignore
    }
    return NextResponse.redirect(`${baseUrl}/login`);
  }
  if (session.identityType === "partner") {
    return NextResponse.redirect(`${baseUrl}/p`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
