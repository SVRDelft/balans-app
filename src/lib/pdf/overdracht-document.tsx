import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import type { Balans } from "@/lib/finance/balans";
import type { Exploitatie, PostGroep } from "@/lib/finance/exploitatie";
import type { Ouderdomsanalyse } from "@/lib/finance/debiteuren";

export interface OverdrachtGegevens {
  logoSrc: string;
  contactregels: string[];
  organisatieNaam: string;
  boekjaarNaam: string;
  startDatum: Date;
  eindDatum: Date;
  gemaaktOp: Date;
  gemaaktDoor: string;

  exploitatie: Exploitatie;
  balans: Balans;
  ouderdom: Ouderdomsanalyse;
  ingevoerdBanksaldoCenten: number | null;
  banksaldoDatum: Date | null;
  voorraadposten: {
    id: string;
    naam: string;
    eenheid: string;
    beginAantal: number;
    beginWaardePerStukCenten: number;
    aantal: number;
    waardePerStukCenten: number;
    locatie: string;
    notities: string;
  }[];

  debiteuren: {
    nummer: string;
    relatieNaam: string;
    factuurdatum: Date;
    openstaandCenten: number;
  }[];

  crediteuren: {
    datum: Date;
    leverancierNaam: string;
    omschrijving: string;
    bedragCenten: number;
  }[];

  evenementen: {
    naam: string;
    kostenCenten: number;
    gefactureerdCenten: number;
    ontvangenCenten: number;
    verschilCenten: number;
  }[];
}

const stijl = StyleSheet.create({
  pagina: {
    paddingTop: 96,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1c2330",
    lineHeight: 1.2,
  },
  titel: {
    fontSize: 17,
    lineHeight: 1.25,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  ondertitel: {
    fontSize: 9,
    lineHeight: 1.3,
    color: "#5b6472",
    marginBottom: 10,
  },
  sectie: {
    fontSize: 12,
    lineHeight: 1.25,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  subsectie: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#5b6472",
    marginTop: 6,
    marginBottom: 3,
  },
  rij: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e6ec",
    paddingVertical: 2,
  },
  koprij: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c2330",
    paddingBottom: 3,
  },
  totaalrij: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1c2330",
    paddingTop: 3,
    marginTop: 2,
  },
  vet: { fontFamily: "Helvetica-Bold" },
  breed: { flex: 1 },
  bedrag: { width: 80, textAlign: "right" },
  smal: { width: 70 },
  voet: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 7.5,
    height: 14,
    color: "#5b6472",
    textAlign: "center",
  },
});

function Rapportkop({ gegevens }: { gegevens: OverdrachtGegevens }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 28,
        left: 44,
        right: 44,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <PdfImage
        src={gegevens.logoSrc}
        style={{ width: 44, height: 44, objectFit: "contain", marginRight: 12 }}
      />
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", flex: 1 }}>
        {gegevens.organisatieNaam}
      </Text>
    </View>
  );
}

function Bedragrij({
  label,
  begroot,
  gerealiseerd,
  vet,
}: {
  label: string;
  begroot?: number;
  gerealiseerd: number;
  vet?: boolean;
}) {
  return (
    <View style={vet ? stijl.totaalrij : stijl.rij}>
      <Text style={[stijl.breed, ...(vet ? [stijl.vet] : [])]}>{label}</Text>
      <Text style={[stijl.bedrag, ...(vet ? [stijl.vet] : [])]}>
        {begroot === undefined ? "" : formatteerEuro(begroot)}
      </Text>
      <Text style={[stijl.bedrag, ...(vet ? [stijl.vet] : [])]}>
        {formatteerEuro(gerealiseerd)}
      </Text>
    </View>
  );
}

function Groep({ groep, titel }: { groep: PostGroep; titel: string }) {
  if (groep.regels.length === 0) return null;

  return (
    <>
      <Text style={stijl.subsectie}>{titel}</Text>
      {groep.regels.map((regel) => (
        <Bedragrij
          key={regel.id}
          label={`${regel.code} — ${regel.naam}`}
          begroot={regel.begrootCenten}
          gerealiseerd={regel.gerealiseerdCenten}
        />
      ))}
      <Bedragrij
        label={`Subtotaal ${titel.toLowerCase()}`}
        begroot={groep.begrootCenten}
        gerealiseerd={groep.gerealiseerdCenten}
        vet
      />
    </>
  );
}

export function OverdrachtDocument({
  gegevens,
}: {
  gegevens: OverdrachtGegevens;
}) {
  const e = gegevens.exploitatie;
  const b = gegevens.balans;

  return (
    <Document
      title={`Overdracht ${gegevens.boekjaarNaam}`}
      author={gegevens.organisatieNaam}
    >
      <Page size="A4" style={stijl.pagina}>
        <Rapportkop gegevens={gegevens} />
        <Text style={stijl.titel}>
          Financiële overdracht {gegevens.boekjaarNaam}
        </Text>
        <Text style={stijl.ondertitel}>
          {gegevens.organisatieNaam} · {formatteerDatum(gegevens.startDatum)}{" "}
          t/m {formatteerDatum(gegevens.eindDatum)} · opgesteld op{" "}
          {formatteerDatum(gegevens.gemaaktOp)}
          {gegevens.gemaaktDoor ? ` door ${gegevens.gemaaktDoor}` : ""}
        </Text>

        {gegevens.contactregels.map((regel, index) => (
          <Text key={index} style={{ fontSize: 8, color: "#5b6472" }}>
            {regel}
          </Text>
        ))}
        <Text style={stijl.sectie}>Exploitatie</Text>
        <View style={stijl.koprij}>
          <Text style={[stijl.breed, stijl.vet]}>Post</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Begroot</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Gerealiseerd</Text>
        </View>

        <Text style={stijl.subsectie}>VASTE POSTEN</Text>
        <Groep groep={e.vast.inkomsten} titel="Inkomsten" />
        <Groep groep={e.vast.uitgaven} titel="Uitgaven" />
        <Bedragrij
          label="Saldo vaste posten"
          begroot={e.vast.saldoBegrootCenten}
          gerealiseerd={e.vast.saldoGerealiseerdCenten}
          vet
        />

        <Text style={stijl.subsectie}>OMSLAGPOSTEN</Text>
        <Groep groep={e.omslag.inkomsten} titel="Inkomsten" />
        <Groep groep={e.omslag.uitgaven} titel="Uitgaven" />
        <Bedragrij
          label="Saldo omslagposten"
          begroot={e.omslag.saldoBegrootCenten}
          gerealiseerd={e.omslag.saldoGerealiseerdCenten}
          vet
        />

        <View style={{ marginTop: 10 }}>
          <Bedragrij
            label="Totaal inkomsten"
            begroot={e.totaalInkomstenBegrootCenten}
            gerealiseerd={e.totaalInkomstenGerealiseerdCenten}
          />
          <Bedragrij
            label="Totaal uitgaven"
            begroot={e.totaalUitgavenBegrootCenten}
            gerealiseerd={e.totaalUitgavenGerealiseerdCenten}
          />
          <Bedragrij
            label="Voorraadmutatie (huidige waarde min beginwaarde)"
            begroot={0}
            gerealiseerd={e.voorraadMutatieCenten}
          />
          <Bedragrij
            label="EINDSALDO"
            begroot={e.eindsaldoBegrootCenten}
            gerealiseerd={e.eindsaldoGerealiseerdCenten}
            vet
          />
        </View>

        <View style={stijl.voet} fixed>
          <Text>
            {gegevens.organisatieNaam} · overdracht {gegevens.boekjaarNaam}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={stijl.pagina}>
        <Rapportkop gegevens={gegevens} />
        <Text style={stijl.sectie}>Balans</Text>

        <Text style={stijl.subsectie}>ACTIVA</Text>
        <Bedragrij
          label="Banksaldo volgens de administratie"
          gerealiseerd={b.administratiefBanksaldoCenten}
        />
        <Bedragrij
          label="Openstaande debiteuren"
          gerealiseerd={b.debiteurenCenten}
        />
        <Bedragrij label="Spullen & voorraad" gerealiseerd={b.voorraadCenten} />
        <Bedragrij
          label="Totaal activa"
          gerealiseerd={b.totaalActivaCenten}
          vet
        />

        <Text style={stijl.subsectie}>PASSIVA</Text>
        <Bedragrij
          label="Openstaande crediteuren"
          gerealiseerd={b.crediteurenCenten}
        />
        <Bedragrij
          label="Eigen vermogen begin boekjaar"
          gerealiseerd={b.eigenVermogenBeginCenten}
        />
        <Bedragrij
          label="Resultaat lopend boekjaar"
          gerealiseerd={b.resultaatCenten}
        />
        {b.beginbalansverschilCenten !== 0 ? (
          <Bedragrij
            label="Beginbalans: overige vorderingen en schulden"
            gerealiseerd={b.beginbalansverschilCenten}
          />
        ) : null}
        <Bedragrij
          label="Totaal passiva"
          gerealiseerd={b.totaalPassivaCenten}
          vet
        />

        <Text style={stijl.subsectie}>CONTROLES</Text>
        <Bedragrij
          label="Activa min passiva"
          gerealiseerd={b.balansverschilCenten}
        />
        {gegevens.ingevoerdBanksaldoCenten !== null ? (
          <>
            <Bedragrij
              label={`Ingevoerd banksaldo${gegevens.banksaldoDatum ? ` per ${formatteerDatum(gegevens.banksaldoDatum)}` : ""}`}
              gerealiseerd={gegevens.ingevoerdBanksaldoCenten}
            />
            <Bedragrij
              label="Verschil met de administratie"
              gerealiseerd={b.bankverschilCenten ?? 0}
            />
          </>
        ) : (
          <Text style={{ marginTop: 4, color: "#5b6472" }}>
            Er is geen banksaldo ingevoerd, dus de controle op het werkelijke
            saldo kon niet gedaan worden.
          </Text>
        )}

        <Text style={stijl.sectie}>Openstaande debiteuren</Text>
        <Text style={{ color: "#5b6472", marginBottom: 4 }}>
          Tot 30 dagen {formatteerEuro(gegevens.ouderdom.tot30)} · 30 tot 60
          dagen {formatteerEuro(gegevens.ouderdom.van30tot60)} · meer dan 60
          dagen {formatteerEuro(gegevens.ouderdom.meer60)}
        </Text>
        <View style={stijl.koprij}>
          <Text style={[stijl.smal, stijl.vet]}>Nummer</Text>
          <Text style={[stijl.breed, stijl.vet]}>Relatie</Text>
          <Text style={[stijl.smal, stijl.vet]}>Datum</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Openstaand</Text>
        </View>
        {gegevens.debiteuren.length === 0 ? (
          <Text style={{ paddingVertical: 4, color: "#5b6472" }}>
            Geen openstaande facturen.
          </Text>
        ) : null}
        {gegevens.debiteuren.map((factuur) => (
          <View style={stijl.rij} key={factuur.nummer} wrap={false}>
            <Text style={stijl.smal}>{factuur.nummer}</Text>
            <Text style={stijl.breed}>{factuur.relatieNaam}</Text>
            <Text style={stijl.smal}>
              {formatteerDatum(factuur.factuurdatum)}
            </Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(factuur.openstaandCenten)}
            </Text>
          </View>
        ))}
        <View style={stijl.totaalrij}>
          <Text style={[stijl.breed, stijl.vet]}>Totaal openstaand</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>
            {formatteerEuro(gegevens.ouderdom.totaal)}
          </Text>
        </View>

        <Text style={stijl.sectie}>Nog te betalen aan leveranciers</Text>
        <View style={stijl.koprij}>
          <Text style={[stijl.smal, stijl.vet]}>Datum</Text>
          <Text style={[stijl.breed, stijl.vet]}>
            Leverancier en omschrijving
          </Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Bedrag</Text>
        </View>
        {gegevens.crediteuren.length === 0 ? (
          <Text style={{ paddingVertical: 4, color: "#5b6472" }}>
            Alles is betaald.
          </Text>
        ) : null}
        {gegevens.crediteuren.map((uitgave, index) => (
          <View style={stijl.rij} key={index} wrap={false}>
            <Text style={stijl.smal}>{formatteerDatum(uitgave.datum)}</Text>
            <Text style={stijl.breed}>
              {uitgave.leverancierNaam} — {uitgave.omschrijving}
            </Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(uitgave.bedragCenten)}
            </Text>
          </View>
        ))}

        <Text style={stijl.sectie}>Afstemming evenementen</Text>
        <View style={stijl.koprij}>
          <Text style={[stijl.breed, stijl.vet]}>Evenement</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Kosten</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Gefactureerd</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Ontvangen</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Verschil</Text>
        </View>
        {gegevens.evenementen.length === 0 ? (
          <Text style={{ paddingVertical: 4, color: "#5b6472" }}>
            Geen evenementen in dit boekjaar.
          </Text>
        ) : null}
        {gegevens.evenementen.map((evenement) => (
          <View style={stijl.rij} key={evenement.naam} wrap={false}>
            <Text style={stijl.breed}>{evenement.naam}</Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(evenement.kostenCenten)}
            </Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(evenement.gefactureerdCenten)}
            </Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(evenement.ontvangenCenten)}
            </Text>
            <Text style={stijl.bedrag}>
              {formatteerEuro(evenement.verschilCenten)}
            </Text>
          </View>
        ))}

        <Text style={{ marginTop: 16, color: "#5b6472" }}>
          Uitgangspunt is het baten-lastenstelsel: een factuur telt mee zodra
          hij verstuurd is en een uitgave zodra hij geregistreerd is, ongeacht
          of er al betaald is. Concepten tellen niet mee. Verstuurde credits
          corrigeren de oorspronkelijke opbrengst; bij oninbaar blijft alleen
          het ontvangen deel meetellen.
        </Text>

        <View style={stijl.voet} fixed>
          <Text>
            {gegevens.organisatieNaam} · overdracht {gegevens.boekjaarNaam}
          </Text>
        </View>
      </Page>
      <Page size="A4" style={stijl.pagina}>
        <Rapportkop gegevens={gegevens} />
        <Text style={stijl.titel}>Spullen & voorraad</Text>
        <Text style={stijl.ondertitel}>
          {gegevens.boekjaarNaam} · aantallen en boekwaarde
        </Text>
        <View style={stijl.koprij}>
          <Text style={[stijl.breed, stijl.vet]}>Spullen</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Begin</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Beginwaarde</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Huidig</Text>
          <Text style={[stijl.bedrag, stijl.vet]}>Huidige waarde</Text>
        </View>
        {gegevens.voorraadposten.length === 0 ? (
          <Text style={{ marginTop: 8 }}>
            Geen spullen vastgelegd in dit boekjaar.
          </Text>
        ) : null}
        {gegevens.voorraadposten.map((post) => (
          <View
            key={post.id}
            wrap={false}
            style={{
              borderBottomWidth: 0.5,
              borderBottomColor: "#e2e6ec",
              paddingVertical: 6,
            }}
          >
            <View style={{ flexDirection: "row" }}>
              <Text style={stijl.breed}>{post.naam}</Text>
              <Text style={stijl.bedrag}>
                {post.beginAantal} {post.eenheid}
              </Text>
              <Text style={stijl.bedrag}>
                {formatteerEuro(
                  post.beginAantal * post.beginWaardePerStukCenten,
                )}
              </Text>
              <Text style={stijl.bedrag}>
                {post.aantal} {post.eenheid}
              </Text>
              <Text style={stijl.bedrag}>
                {formatteerEuro(post.aantal * post.waardePerStukCenten)}
              </Text>
            </View>
            <Text style={{ fontSize: 8, color: "#5b6472", marginTop: 3 }}>
              Per {post.eenheid}: begin{" "}
              {formatteerEuro(post.beginWaardePerStukCenten)}, huidig{" "}
              {formatteerEuro(post.waardePerStukCenten)}
              {post.locatie ? ` · Bewaarplaats: ${post.locatie}` : ""}
            </Text>
            {post.notities ? (
              <Text style={{ fontSize: 8, color: "#5b6472" }}>
                {post.notities}
              </Text>
            ) : null}
          </View>
        ))}
        <View style={{ marginTop: 12 }}>
          <Bedragrij
            label="Waarde begin boekjaar"
            gerealiseerd={b.voorraadCenten - b.voorraadMutatieCenten}
          />
          <Bedragrij
            label="Huidige waarde op de balans"
            gerealiseerd={b.voorraadCenten}
            vet
          />
          <Bedragrij
            label="Voorraadmutatie in het resultaat"
            gerealiseerd={b.voorraadMutatieCenten}
          />
        </View>
        <Text style={{ marginTop: 14, color: "#5b6472" }}>
          Aankopen staan ook bij de uitgaven. De verandering in voorraadwaarde
          corrigeert het resultaat voor spullen die nog aanwezig zijn of zijn
          verbruikt. De beginvoorraad hoort bij het eigen vermogen aan het begin
          van het boekjaar.
        </Text>
        <View style={stijl.voet} fixed>
          <Text>
            {gegevens.organisatieNaam} · overdracht {gegevens.boekjaarNaam}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
