// Wat je ziet terwijl een scherm van de administratie wordt opgehaald.
//
// Zonder dit blijft de pagina staan tot alle cijfers geteld zijn, en lijkt het
// alsof je klik niet is aangekomen. Een paar grijze blokken in dezelfde maten
// als de echte inhoud is genoeg: het scherm verspringt dan ook niet.
export default function AanHetLaden() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Bezig met laden…</span>
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-muted" />
        <div className="h-4 w-80 rounded bg-muted/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((nummer) => (
          <div key={nummer} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-border bg-card" />
    </div>
  );
}
