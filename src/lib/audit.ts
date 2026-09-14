import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Transactie = Pick<Prisma.TransactionClient, "auditlog">;

export interface AuditRegel {
  gebruiker: string;
  entiteit: string;
  entiteitId?: string | null;
  actie: string;
  samenvatting: string;
  details?: unknown;
  boekjaarId?: string | null;
}

/**
 * Schrijft een regel in het auditlog. Twee mensen werken in hetzelfde systeem;
 * zonder dit spoor is achteraf niet te zien wie wat veranderd heeft.
 *
 * Geef `tx` mee vanuit een transactie, zodat de regel samen met de wijziging
 * wordt vastgelegd of samen sneuvelt.
 */
export async function logAudit(
  regel: AuditRegel,
  tx: Transactie = db,
): Promise<void> {
  await tx.auditlog.create({
    data: {
      gebruiker: regel.gebruiker,
      entiteit: regel.entiteit,
      entiteitId: regel.entiteitId ?? null,
      actie: regel.actie,
      samenvatting: regel.samenvatting,
      details:
        regel.details === undefined ? null : JSON.stringify(regel.details),
      boekjaarId: regel.boekjaarId ?? null,
    },
  });
}
