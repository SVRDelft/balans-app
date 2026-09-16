import "server-only";
import { db } from "@/lib/db";

/** Form IDs are untrusted, even when their selects only show the active year. */
export async function controleerKoppelingen(boekjaarId: string, postIds: string[], evenementId?: string | null) {
  const uniek = [...new Set(postIds.filter(Boolean))];
  const aantal = await db.begrotingspost.count({ where: { id: { in: uniek }, boekjaarId } });
  if (aantal !== uniek.length) throw new Error("Kies begrotingsposten uit het actieve boekjaar.");
  if (evenementId && !await db.evenement.findFirst({ where: { id: evenementId, boekjaarId } })) {
    throw new Error("Kies een evenement uit het actieve boekjaar.");
  }
}
