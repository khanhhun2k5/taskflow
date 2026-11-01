// Route guard, edge layer of ADR-11. Next.js 16 renamed `middleware` to `proxy`.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//         https://nextjs.org/docs/app/api-reference/file-conventions/proxy
// Only checks that a session cookie exists; the full session check happens in the
// (app) layout and in withUser. Never use this file for data authorization.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Better Auth helper: handles the "__Secure-" prefix used in production.
  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/today/:path*",
    "/inbox/:path*",
    "/calendar/:path*",
    "/search/:path*",
    "/trash/:path*",
    "/settings/:path*",
    "/projects/:path*",
    "/courses/:path*",
  ],
};
