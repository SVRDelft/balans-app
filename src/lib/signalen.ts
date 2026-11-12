import "server-only";

import { portaalStand } from "@/lib/portaal/stand";

// Wat het dashboard onder "Te doen" meldt, naast de vervallen facturen en de
// bankcontroles die daar al stonden. Elk signaal zegt wat er is en waar je het
// oplost; de app lost niets zelf op.

export interface Signaal {
  id: string;
  toon: "waarschuwing" | "fout";
  tekst: string;
  link?: { href: string; label: string };
}

export async function portaalSignaal(): Promise<Signaal | null> {
  const stand = await portaalStand();
  if (stand.metWachtwoord >= stand.totaal) return null;
  return {
    id: "portaal",
    toon: "waarschuwing",
    tekst: `${stand.metWachtwoord} van ${stand.totaal} hebben een wachtwoord voor het portaal · ${stand.recentIngelogd} hebben de afgelopen 30 dagen ingelogd.`,
    link: { href: "/beheer/portaaltoegang", label: "Naar portaaltoegang" },
  };
}

export async function haalSignalen(_boekjaarId: string): Promise<Signaal[]> {
  const signalen = await Promise.all([portaalSignaal()]);
  return signalen.filter((signaal): signaal is Signaal => signaal !== null);
}
