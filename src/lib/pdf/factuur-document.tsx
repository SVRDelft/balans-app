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

export interface FactuurPdfGegevens {
  logoSrc: string;
  nummer: string;
  omschrijving: string;
  factuurdatum: Date;
  vervaldatum: Date;
  status: string;
  isConcept: boolean;
  isCredit: boolean;
  notities: string | null;
  totaalCenten: number;
  betaaldCenten: number;

  regels: {
    omschrijving: string;
    aantal: number;
    prijsPerStukCenten: number;
    bedragCenten: number;
  }[];

  relatie: {
    naam: string;
    contactpersoon: string | null;
    adres: string | null;
    postcode: string | null;
    plaats: string | null;
    land: string;
    email: string | null;
    kvkNummer: string;
    btwNummer: string;
  };

  afzender: {
    organisatieNaam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    iban: string;
    kvkNummer: string;
    btwPlichtig: boolean;
    btwPercentage: number;
    voetnoot: string;
    contactpersoon: string;
    land: string;
    telefoon: string;
    website: string;
    btwNummer: string;
  };
}

const stijl = StyleSheet.create({
  pagina: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1c2330",
    lineHeight: 1.5,
  },
  stempel: {
    position: "absolute",
    top: 26,
    right: 48,
    fontSize: 9,
    color: "#b23b3b",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  kop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  organisatie: {
    fontSize: 14,
    lineHeight: 1.25,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  klein: { fontSize: 9, color: "#5b6472" },
  titel: {
    fontSize: 18,
    lineHeight: 1.25,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  blokken: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  blok: { width: "48%" },
  blokkop: {
    fontSize: 8,
    color: "#5b6472",
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  gegevensrij: { flexDirection: "row", justifyContent: "space-between" },
  tabelkop: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c2330",
    paddingBottom: 5,
    marginTop: 8,
  },
  rij: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dfe3e9",
    paddingVertical: 6,
  },
  kolomOmschrijving: { width: "52%" },
  kolomAantal: { width: "12%", textAlign: "right" },
  kolomPrijs: { width: "18%", textAlign: "right" },
  kolomBedrag: { width: "18%", textAlign: "right" },
  vet: { fontFamily: "Helvetica-Bold" },
  totaalrij: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 6,
  },
  totaalLabel: { width: "30%", textAlign: "right", paddingRight: 12 },
  totaalBedrag: { width: "18%", textAlign: "right" },
  notities: {
    marginTop: 24,
    padding: 10,
    backgroundColor: "#f4f6f9",
    borderRadius: 4,
  },
  voet: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: "#dfe3e9",
    paddingTop: 8,
    fontSize: 8,
    color: "#5b6472",
  },
});

export function FactuurDocument({ factuur }: { factuur: FactuurPdfGegevens }) {
  const openstaand = factuur.totaalCenten - factuur.betaaldCenten;

  return (
    <Document
      title={`Factuur ${factuur.nummer}`}
      author={factuur.afzender.organisatieNaam}
      subject={factuur.omschrijving}
    >
      <Page size="A4" style={stijl.pagina}>
        {factuur.isConcept ? <Text style={stijl.stempel}>CONCEPT</Text> : null}

        <View style={stijl.kop}>
          <View style={{ width: "64%" }}>
            <PdfImage
              src={factuur.logoSrc}
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                marginBottom: 8,
              }}
            />
            <Text style={stijl.organisatie}>
              {factuur.afzender.organisatieNaam}
            </Text>
            {factuur.afzender.adres ? (
              <Text style={stijl.klein}>{factuur.afzender.adres}</Text>
            ) : null}
            {factuur.afzender.postcode || factuur.afzender.plaats ? (
              <Text style={stijl.klein}>
                {factuur.afzender.postcode} {factuur.afzender.plaats}
              </Text>
            ) : null}
            {factuur.afzender.email ? (
              <Text style={stijl.klein}>{factuur.afzender.email}</Text>
            ) : null}
            {[
              factuur.afzender.land,
              factuur.afzender.contactpersoon,
              factuur.afzender.telefoon,
              factuur.afzender.website,
            ]
              .filter(Boolean)
              .map((tekst, index) => (
                <Text key={index} style={stijl.klein}>
                  {tekst}
                </Text>
              ))}
          </View>
          <View style={{ width: "32%" }}>
            <Text style={stijl.titel}>
              {factuur.isCredit ? "Creditfactuur" : "Factuur"}
            </Text>
            <Text style={[stijl.klein, { textAlign: "right" }]}>
              {factuur.nummer}
            </Text>
          </View>
        </View>

        <View style={stijl.blokken}>
          <View style={stijl.blok}>
            <Text style={stijl.blokkop}>AAN</Text>
            <Text style={stijl.vet}>{factuur.relatie.naam}</Text>
            {factuur.relatie.contactpersoon ? (
              <Text>{factuur.relatie.contactpersoon}</Text>
            ) : null}
            {factuur.relatie.adres ? (
              <Text>{factuur.relatie.adres}</Text>
            ) : null}
            {factuur.relatie.postcode || factuur.relatie.plaats ? (
              <Text>
                {factuur.relatie.postcode} {factuur.relatie.plaats}
              </Text>
            ) : null}
            {[
              factuur.relatie.land,
              factuur.relatie.email,
              factuur.relatie.kvkNummer
                ? `KvK ${factuur.relatie.kvkNummer}`
                : "",
              factuur.relatie.btwNummer
                ? `Btw-id ${factuur.relatie.btwNummer}`
                : "",
            ]
              .filter(Boolean)
              .map((tekst, index) => (
                <Text key={index}>{tekst}</Text>
              ))}
          </View>

          <View style={stijl.blok}>
            <Text style={stijl.blokkop}>GEGEVENS</Text>
            <View style={stijl.gegevensrij}>
              <Text style={stijl.klein}>Factuurnummer</Text>
              <Text>{factuur.nummer}</Text>
            </View>
            <View style={stijl.gegevensrij}>
              <Text style={stijl.klein}>Factuurdatum</Text>
              <Text>{formatteerDatum(factuur.factuurdatum)}</Text>
            </View>
            <View style={stijl.gegevensrij}>
              <Text style={stijl.klein}>Vervaldatum</Text>
              <Text>{formatteerDatum(factuur.vervaldatum)}</Text>
            </View>
          </View>
        </View>

        <Text style={stijl.vet}>{factuur.omschrijving}</Text>

        <View style={stijl.tabelkop}>
          <Text style={[stijl.kolomOmschrijving, stijl.vet]}>Omschrijving</Text>
          <Text style={[stijl.kolomAantal, stijl.vet]}>Aantal</Text>
          <Text style={[stijl.kolomPrijs, stijl.vet]}>Per stuk</Text>
          <Text style={[stijl.kolomBedrag, stijl.vet]}>Bedrag</Text>
        </View>

        {factuur.regels.map((regel, index) => (
          <View style={stijl.rij} key={index} wrap={false}>
            <Text style={stijl.kolomOmschrijving}>{regel.omschrijving}</Text>
            <Text style={stijl.kolomAantal}>{regel.aantal}</Text>
            <Text style={stijl.kolomPrijs}>
              {formatteerEuro(regel.prijsPerStukCenten)}
            </Text>
            <Text style={stijl.kolomBedrag}>
              {formatteerEuro(regel.bedragCenten)}
            </Text>
          </View>
        ))}

        <View style={stijl.totaalrij}>
          <Text style={[stijl.totaalLabel, stijl.vet]}>Totaal</Text>
          <Text style={[stijl.totaalBedrag, stijl.vet]}>
            {formatteerEuro(factuur.totaalCenten)}
          </Text>
        </View>

        {factuur.betaaldCenten !== 0 ? (
          <>
            <View style={stijl.totaalrij}>
              <Text style={stijl.totaalLabel}>Reeds ontvangen</Text>
              <Text style={stijl.totaalBedrag}>
                {formatteerEuro(factuur.betaaldCenten)}
              </Text>
            </View>
            <View style={stijl.totaalrij}>
              <Text style={[stijl.totaalLabel, stijl.vet]}>Nog te voldoen</Text>
              <Text style={[stijl.totaalBedrag, stijl.vet]}>
                {formatteerEuro(openstaand)}
              </Text>
            </View>
          </>
        ) : null}

        {factuur.notities ? (
          <View style={stijl.notities}>
            <Text>{factuur.notities}</Text>
          </View>
        ) : null}

        <View style={stijl.voet} fixed>
          <Text>
            {factuur.afzender.voetnoot ||
              "Wij verzoeken u het bedrag binnen de betaaltermijn over te maken onder vermelding van het factuurnummer."}
          </Text>
          <Text>
            {factuur.afzender.iban ? `IBAN ${factuur.afzender.iban}` : ""}
            {factuur.afzender.kvkNummer
              ? `   KvK ${factuur.afzender.kvkNummer}`
              : ""}
            {"   "}
            {factuur.afzender.btwNummer
              ? `Btw-id ${factuur.afzender.btwNummer}   `
              : ""}
            {factuur.afzender.btwPlichtig
              ? `Btw ${factuur.afzender.btwPercentage}% inbegrepen`
              : "Geen btw verschuldigd"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
