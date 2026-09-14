import { haalSessie } from "@/lib/auth/server";
import { haalBoekjaarContext } from "@/lib/boekjaar";
import { maakOverdrachtWerkboek } from "@/lib/export/excel";

export const runtime = "nodejs";

export async function GET() {
  const sessie = await haalSessie();
  if (!sessie) return new Response("Niet ingelogd", { status: 401 });

  const context = await haalBoekjaarContext();
  if (!context) return new Response("Geen boekjaar gevonden", { status: 404 });

  const buffer = await maakOverdrachtWerkboek(context.boekjaar.id);

  const bestandsnaam = `SVR-overdracht-${context.boekjaar.factuurPrefix}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
      "Cache-Control": "no-store",
    },
  });
}
