import { NextResponse, type NextRequest } from "next/server";

import { SESSIE_COOKIE, leesSessieCookie } from "@/lib/auth/sessie";

const INLOGPAD = "/inloggen";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const sessie = await leesSessieCookie(
    request.cookies.get(SESSIE_COOKIE)?.value,
  );

  if (pathname === INLOGPAD) {
    if (sessie) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!sessie) {
    if (pathname.startsWith("/api/")) return new NextResponse("Niet ingelogd", { status: 401, headers: { "Cache-Control": "no-store" } });
    const doel = new URL(INLOGPAD, request.url);
    if (pathname !== "/") doel.searchParams.set("verder", pathname + search);
    return NextResponse.redirect(doel);
  }

  return NextResponse.next();
}

export const config = {
  // Alles achter het slot, inclusief de API-routes. Alleen de statische
  // bestanden van Next.js zelf blijven buiten schot.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
