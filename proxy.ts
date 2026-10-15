import { type NextRequest, NextResponse } from "next/server";

function isNonPagePath(pathname: string): boolean {
  const segment = pathname.split("/").at(-1) ?? "";
  return (
    segment.includes(".") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/api/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // skipTrailingSlashRedirect is global, so preserve the old site-wide
  // trailing-slash convention here for ordinary page requests.
  if (pathname !== "/" && !pathname.endsWith("/") && !isNonPagePath(pathname)) {
    return NextResponse.redirect(
      new URL(`${pathname}/${search}`, request.url),
      308,
    );
  }

  return NextResponse.next();
}

export const config = {
  // Include pages because skipTrailingSlashRedirect is global; ordinary page
  // requests still need the site's existing slashful canonical URL.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
