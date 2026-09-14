"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { vereisSessie } from "@/lib/auth/server";
import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";
import { db } from "@/lib/db";

/** Wisselt het boekjaar dat bekeken wordt. Schrijven blijft alleen toegestaan
 *  in het actieve boekjaar. */
export async function kiesBoekjaar(boekjaarId: string): Promise<void> {
  await vereisSessie();

  const boekjaar = await db.boekjaar.findUnique({ where: { id: boekjaarId } });
  if (!boekjaar) return;

  const koekjes = await cookies();
  koekjes.set(BOEKJAAR_COOKIE, boekjaar.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
