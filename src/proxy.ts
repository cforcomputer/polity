import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Two hosts, one deployment:
//   polity.geckur.com      marketing site (just "/")
//   app.polity.geckur.com  the product; "/" is the app home
// Any other host (localhost, previews) serves both, with the app home at /home.
// The redirect to app.* waits for POLITY_SPLIT_HOSTS=1, set once that host has DNS and a Caddy site.
export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  const { pathname, search } = request.nextUrl;

  if (host.startsWith("app.")) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/home", request.url));
    return;
  }

  const local = host === "localhost" || host.endsWith(".localhost") || /^[\d.]+$/.test(host);
  if (!local && process.env.POLITY_SPLIT_HOSTS === "1" && pathname !== "/") {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return NextResponse.redirect(`${proto}://app.${host}${pathname === "/home" ? "/" : pathname}${search}`, 308);
  }
}

export const config = {
  // Pages only: API routes, Next assets and files in /public pass straight through on both hosts.
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
