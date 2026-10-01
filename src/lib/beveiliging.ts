// Eén plek die bepaalt of inloggen over een onbeveiligde verbinding mag.
//
// Zolang https nog niet geregeld is op de server van de TU Delft kan de
// publieke site gewoon over http draaien: daar staat niets gevoeligs op. Bij
// inloggen ligt dat anders — wachtwoord en sessiecookie gaan dan leesbaar over
// het netwerk — dus dat weigert de app standaard.
//
// Met ZONDER_HTTPS_INLOGGEN="ja" in de omgevingsvariabelen zet je dat uit. Doe
// dat alleen tijdelijk; de app laat dan overal een waarschuwing zien.

export const inloggenZonderHttpsToegestaan = () =>
  process.env.ZONDER_HTTPS_INLOGGEN === "ja";

/**
 * Draait de app zonder https, en mag dat? Dan hoort het cookie niet de vlag
 * `Secure` te krijgen, want anders stuurt de browser het nooit mee.
 */
export const cookieAlleenOverHttps = () =>
  process.env.NODE_ENV === "production" && !inloggenZonderHttpsToegestaan();

/** Komt dit verzoek over https binnen? Achter Passenger of een proxy staat dat in een header. */
export function isBeveiligdeVerbinding(headers: Headers, protocol?: string) {
  const doorgestuurd = headers.get("x-forwarded-proto");
  if (doorgestuurd) return doorgestuurd.split(",")[0].trim() === "https";
  if (protocol) return protocol.replace(":", "") === "https";
  return false;
}

/**
 * Mag er op deze verbinding ingelogd worden? In ontwikkeling altijd; in
 * productie alleen over https, of als het bestuur dat bewust heeft toegestaan.
 */
export function mageInloggen(headers: Headers, protocol?: string) {
  if (process.env.NODE_ENV !== "production") return true;
  if (isBeveiligdeVerbinding(headers, protocol)) return true;
  return inloggenZonderHttpsToegestaan();
}

/** Loopt het verkeer nu onbeveiligd, terwijl er wel ingelogd kan worden? */
export function onbeveiligdMaarToegestaan(headers: Headers, protocol?: string) {
  return (
    process.env.NODE_ENV === "production" &&
    !isBeveiligdeVerbinding(headers, protocol) &&
    inloggenZonderHttpsToegestaan()
  );
}
