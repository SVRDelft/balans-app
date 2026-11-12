"use client";

import { useActionState } from "react";
import { CalendarDays } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarGoogleAgenda, maakAgendaLink, trekAgendaLinkIn } from "./acties";

export function AgendaInstellingen({
  googleAgendaUrl,
  feedPad,
}: {
  googleAgendaUrl: string;
  /** /agenda/<sleutel>, of null als er geen link is. */
  feedPad: string | null;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(bewaarGoogleAgenda, {});
  const feed = feedPad ? `https://svr.tudelft.nl${feedPad}` : null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Agenda</CardTitle>
        <CardDescription>
          Zodat besturen de vergaderingen en activiteiten in hun eigen agenda zetten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={actie} className="space-y-3">
          <Veld
            label="Openbare Google-agenda (“SVR 62 – Bestuurlijk Delft”)"
            htmlFor="googleAgendaUrl"
            toelichting="In Google Calendar: Instellingen › de agenda › Openbaar adres. Ingevuld? Dan toont het portaal de knop “Alle activiteiten (cobo’s, Dé DDB, gala)”."
          >
            <Input
              id="googleAgendaUrl"
              name="googleAgendaUrl"
              type="url"
              defaultValue={googleAgendaUrl}
              placeholder="https://calendar.google.com/calendar/…"
            />
          </Veld>
          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
          {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
          <Button type="submit" variant="outline" disabled={bezig}>
            {bezig ? "Bezig…" : "Opslaan"}
          </Button>
        </form>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="flex items-center gap-2 font-medium">
            <CalendarDays className="size-4" /> Agenda-feed met de vergaderingen
          </p>
          <p className="text-sm text-muted-foreground">
            Een geheime link die besturen in Google Calendar of Outlook zetten (“abonneren via
            URL”). Erin staan alleen datum, tijd, overleg, locatie en wie ontvangt. Het portaal
            toont de link aan wie is ingelogd. Een nieuwe link maken trekt de oude meteen in.
          </p>
          {feed ? (
            <>
              <Input
                readOnly
                value={feed}
                onFocus={(gebeurtenis) => gebeurtenis.currentTarget.select()}
                aria-label="Agenda-feed"
              />
              <p className="text-xs text-muted-foreground">
                Per overleg: zet er <code>?overleg=SVR</code>, <code>?overleg=SVR-O</code>,{" "}
                <code>?overleg=SVeuRo</code> of <code>?overleg=SVjwR</code> achter.
              </p>
            </>
          ) : (
            <p className="text-sm">
              Er is nog geen link. Het portaal biedt dan alleen een download van het .ics-bestand aan.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <BevestigKnop
              actie={maakAgendaLink}
              velden={{}}
              vraag={
                feed
                  ? "Een nieuwe link maken? De huidige werkt daarna niet meer."
                  : "Een link voor de agenda-feed maken?"
              }
              size="sm"
            >
              {feed ? "Nieuwe link (oude intrekken)" : "Link maken"}
            </BevestigKnop>
            {feed ? (
              <BevestigKnop
                actie={trekAgendaLinkIn}
                velden={{}}
                vraag="De link intrekken? Agenda’s die hem gebruiken, krijgen geen nieuwe data meer."
                size="sm"
                variant="ghost"
              >
                Intrekken
              </BevestigKnop>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
