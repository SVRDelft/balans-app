import { NextResponse, type NextRequest } from "next/server";

import { SESSIE_COOKIE, leesSessieCookie } from "@/lib/auth/sessie";

const INLOGPAD = "/inloggen";

/** Alles hierachter is alleen voor ingelogde mensen. De rest is de publieke site. */
const BESCHERMD = ["/beheer", "/portaal", "/api", "/wachtwoord"];

const isBeschermd = (pad: string) =>
  BESCHERMD.some((begin) => pad === begin || pad.startsWith(`${begin}/`));

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const sessie = await leesSessieCookie(
    request.cookies.get(SESSIE_COOKIE)?.value,
  );

  // Op de inlogpagina zelf beslist de pagina: die kijkt in de database of een
  // sessie nog klopt. Hier wegsturen op alleen het cookie gaf een lus bij een
  // account of vereniging die intussen was uitgezet.
  if (pathname === INLOGPAD) return NextResponse.next();

  if (!isBeschermd(pathname)) return NextResponse.next();

  if (!sessie) {
    if (pathname.startsWith("/api/"))
      return new NextResponse("Niet ingelogd", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    const doel = new URL(INLOGPAD, request.url);
    doel.searchParams.set("verder", pathname + search);
    return NextResponse.redirect(doel);
  }

  return NextResponse.next();
}

export const config = {
  // Alleen de statische bestanden van Next.js zelf blijven buiten schot; welke
  // paden achter het slot zitten bepaalt de code hierboven.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
