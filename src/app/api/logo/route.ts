import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { logoBestand } from "@/lib/logo";

export const runtime = "nodejs";

export async function GET() {
  if (!(await haalSessie()))
    return new Response("Niet ingelogd", { status: 401 });
  const instellingen = await db.instellingen.findUnique({
    where: { id: "svr" },
    select: { logoData: true, logoMimeType: true },
  });
  const logo = await logoBestand(instellingen);
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
