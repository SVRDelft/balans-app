-- CreateTable
CREATE TABLE "Instellingen" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'svr',
    "organisatieNaam" TEXT NOT NULL DEFAULT 'StudieVerenigingenRaad Delft',
    "adres" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "plaats" TEXT NOT NULL DEFAULT 'Delft',
    "email" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "kvkNummer" TEXT NOT NULL DEFAULT '',
    "btwPlichtig" BOOLEAN NOT NULL DEFAULT false,
    "btwPercentage" INTEGER NOT NULL DEFAULT 21,
    "betaaltermijnDagen" INTEGER NOT NULL DEFAULT 30,
    "factuurVoetnoot" TEXT NOT NULL DEFAULT '',
    "bijgewerktOp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Boekjaar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "naam" TEXT NOT NULL,
    "factuurPrefix" TEXT NOT NULL,
    "startDatum" DATETIME NOT NULL,
    "eindDatum" DATETIME NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT false,
    "beginsaldoBankCenten" INTEGER NOT NULL DEFAULT 0,
    "beginsaldoEigenVermogenCenten" INTEGER NOT NULL DEFAULT 0,
    "factuurTeller" INTEGER NOT NULL DEFAULT 0,
    "notities" TEXT,
    "aangemaaktOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Relatie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "contactpersoon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "postcode" TEXT,
    "plaats" TEXT,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "bijdragePlichtig" BOOLEAN NOT NULL DEFAULT false,
    "notities" TEXT,
    "aangemaaktOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Begrotingspost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boekjaarId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "soort" TEXT NOT NULL,
    "begrootCenten" INTEGER NOT NULL DEFAULT 0,
    "volgorde" INTEGER NOT NULL DEFAULT 0,
    "notities" TEXT,
    CONSTRAINT "Begrotingspost_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Factuur" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boekjaarId" TEXT NOT NULL,
    "nummer" TEXT NOT NULL,
    "volgnummer" INTEGER NOT NULL,
    "relatieId" TEXT NOT NULL,
    "factuurdatum" DATETIME NOT NULL,
    "vervaldatum" DATETIME NOT NULL,
    "omschrijving" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concept',
    "soort" TEXT NOT NULL DEFAULT 'normaal',
    "evenementId" TEXT,
    "omslagrondeId" TEXT,
    "crediteertFactuurId" TEXT,
    "totaalCenten" INTEGER NOT NULL DEFAULT 0,
    "notities" TEXT,
    "verstuurdOp" DATETIME,
    "aangemaaktOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" DATETIME NOT NULL,
    CONSTRAINT "Factuur_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Factuur_relatieId_fkey" FOREIGN KEY ("relatieId") REFERENCES "Relatie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Factuur_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Factuur_omslagrondeId_fkey" FOREIGN KEY ("omslagrondeId") REFERENCES "Omslagronde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Factuur_crediteertFactuurId_fkey" FOREIGN KEY ("crediteertFactuurId") REFERENCES "Factuur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Factuurregel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factuurId" TEXT NOT NULL,
    "begrotingspostId" TEXT NOT NULL,
    "omschrijving" TEXT NOT NULL,
    "aantal" INTEGER NOT NULL DEFAULT 1,
    "prijsPerStukCenten" INTEGER NOT NULL,
    "bedragCenten" INTEGER NOT NULL,
    "volgorde" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Factuurregel_factuurId_fkey" FOREIGN KEY ("factuurId") REFERENCES "Factuur" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Factuurregel_begrotingspostId_fkey" FOREIGN KEY ("begrotingspostId") REFERENCES "Begrotingspost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Betaling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factuurId" TEXT NOT NULL,
    "datum" DATETIME NOT NULL,
    "bedragCenten" INTEGER NOT NULL,
    "notitie" TEXT,
    "geregistreerdOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geregistreerdDoor" TEXT,
    CONSTRAINT "Betaling_factuurId_fkey" FOREIGN KEY ("factuurId") REFERENCES "Factuur" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Uitgave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boekjaarId" TEXT NOT NULL,
    "datum" DATETIME NOT NULL,
    "relatieId" TEXT,
    "leverancierNaam" TEXT NOT NULL,
    "omschrijving" TEXT NOT NULL,
    "bedragCenten" INTEGER NOT NULL,
    "begrotingspostId" TEXT NOT NULL,
    "evenementId" TEXT,
    "bedragDefinitief" BOOLEAN NOT NULL DEFAULT false,
    "tenLasteVanSvr" BOOLEAN NOT NULL DEFAULT false,
    "omslagrondeId" TEXT,
    "betaald" BOOLEAN NOT NULL DEFAULT false,
    "betaaldOp" DATETIME,
    "notities" TEXT,
    "bijlageId" TEXT,
    "aangemaaktOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" DATETIME NOT NULL,
    CONSTRAINT "Uitgave_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Uitgave_relatieId_fkey" FOREIGN KEY ("relatieId") REFERENCES "Relatie" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Uitgave_begrotingspostId_fkey" FOREIGN KEY ("begrotingspostId") REFERENCES "Begrotingspost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Uitgave_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Uitgave_omslagrondeId_fkey" FOREIGN KEY ("omslagrondeId") REFERENCES "Omslagronde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Uitgave_bijlageId_fkey" FOREIGN KEY ("bijlageId") REFERENCES "Bijlage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bijlage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestandsnaam" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "grootte" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "geuploadOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geuploadDoor" TEXT
);

-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boekjaarId" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "datum" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "kostenpostId" TEXT,
    "opbrengstpostId" TEXT,
    "notities" TEXT,
    "aangemaaktOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" DATETIME NOT NULL,
    CONSTRAINT "Evenement_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evenement_kostenpostId_fkey" FOREIGN KEY ("kostenpostId") REFERENCES "Begrotingspost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evenement_opbrengstpostId_fkey" FOREIGN KEY ("opbrengstpostId") REFERENCES "Begrotingspost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deelnemer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evenementId" TEXT NOT NULL,
    "relatieId" TEXT,
    "naam" TEXT NOT NULL,
    "aantalPersonen" INTEGER NOT NULL DEFAULT 1,
    "aangemeld" BOOLEAN NOT NULL DEFAULT true,
    "bevestigdBetalend" BOOLEAN NOT NULL DEFAULT false,
    "notities" TEXT,
    CONSTRAINT "Deelnemer_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deelnemer_relatieId_fkey" FOREIGN KEY ("relatieId") REFERENCES "Relatie" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Omslagronde" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evenementId" TEXT NOT NULL,
    "rondeNummer" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "berekendOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berekendDoor" TEXT NOT NULL,
    "totaalKostenCenten" INTEGER NOT NULL,
    "aantalAangemeld" INTEGER NOT NULL,
    "aantalBevestigd" INTEGER NOT NULL,
    "kostprijsPerPersoonCenten" INTEGER NOT NULL,
    "prijsPerPersoonCenten" INTEGER NOT NULL,
    "totaalGefactureerdCenten" INTEGER NOT NULL,
    "notities" TEXT,
    CONSTRAINT "Omslagronde_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OmslagrondeDeelnemer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omslagrondeId" TEXT NOT NULL,
    "deelnemerId" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "aantalPersonen" INTEGER NOT NULL,
    "bedragCenten" INTEGER NOT NULL,
    "factuurId" TEXT,
    CONSTRAINT "OmslagrondeDeelnemer_omslagrondeId_fkey" FOREIGN KEY ("omslagrondeId") REFERENCES "Omslagronde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OmslagrondeDeelnemer_deelnemerId_fkey" FOREIGN KEY ("deelnemerId") REFERENCES "Deelnemer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OmslagrondeDeelnemer_factuurId_fkey" FOREIGN KEY ("factuurId") REFERENCES "Factuur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Banksaldo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boekjaarId" TEXT NOT NULL,
    "datum" DATETIME NOT NULL,
    "saldoCenten" INTEGER NOT NULL,
    "notitie" TEXT,
    "ingevoerdOp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingevoerdDoor" TEXT,
    CONSTRAINT "Banksaldo_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditlog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tijdstip" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruiker" TEXT NOT NULL,
    "entiteit" TEXT NOT NULL,
    "entiteitId" TEXT,
    "actie" TEXT NOT NULL,
    "samenvatting" TEXT NOT NULL,
    "details" TEXT,
    "boekjaarId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Boekjaar_naam_key" ON "Boekjaar"("naam");

-- CreateIndex
CREATE UNIQUE INDEX "Boekjaar_factuurPrefix_key" ON "Boekjaar"("factuurPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "Relatie_naam_key" ON "Relatie"("naam");

-- CreateIndex
CREATE INDEX "Relatie_type_idx" ON "Relatie"("type");

-- CreateIndex
CREATE INDEX "Begrotingspost_boekjaarId_categorie_soort_idx" ON "Begrotingspost"("boekjaarId", "categorie", "soort");

-- CreateIndex
CREATE UNIQUE INDEX "Begrotingspost_boekjaarId_code_key" ON "Begrotingspost"("boekjaarId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Factuur_nummer_key" ON "Factuur"("nummer");

-- CreateIndex
CREATE UNIQUE INDEX "Factuur_crediteertFactuurId_key" ON "Factuur"("crediteertFactuurId");

-- CreateIndex
CREATE INDEX "Factuur_boekjaarId_status_idx" ON "Factuur"("boekjaarId", "status");

-- CreateIndex
CREATE INDEX "Factuur_relatieId_idx" ON "Factuur"("relatieId");

-- CreateIndex
CREATE INDEX "Factuur_evenementId_idx" ON "Factuur"("evenementId");

-- CreateIndex
CREATE INDEX "Factuurregel_factuurId_idx" ON "Factuurregel"("factuurId");

-- CreateIndex
CREATE INDEX "Factuurregel_begrotingspostId_idx" ON "Factuurregel"("begrotingspostId");

-- CreateIndex
CREATE INDEX "Betaling_factuurId_idx" ON "Betaling"("factuurId");

-- CreateIndex
CREATE UNIQUE INDEX "Uitgave_bijlageId_key" ON "Uitgave"("bijlageId");

-- CreateIndex
CREATE INDEX "Uitgave_boekjaarId_idx" ON "Uitgave"("boekjaarId");

-- CreateIndex
CREATE INDEX "Uitgave_evenementId_idx" ON "Uitgave"("evenementId");

-- CreateIndex
CREATE INDEX "Uitgave_begrotingspostId_idx" ON "Uitgave"("begrotingspostId");

-- CreateIndex
CREATE INDEX "Evenement_boekjaarId_idx" ON "Evenement"("boekjaarId");

-- CreateIndex
CREATE INDEX "Deelnemer_evenementId_idx" ON "Deelnemer"("evenementId");

-- CreateIndex
CREATE UNIQUE INDEX "Omslagronde_evenementId_rondeNummer_key" ON "Omslagronde"("evenementId", "rondeNummer");

-- CreateIndex
CREATE INDEX "OmslagrondeDeelnemer_omslagrondeId_idx" ON "OmslagrondeDeelnemer"("omslagrondeId");

-- CreateIndex
CREATE INDEX "Banksaldo_boekjaarId_datum_idx" ON "Banksaldo"("boekjaarId", "datum");

-- CreateIndex
CREATE INDEX "Auditlog_tijdstip_idx" ON "Auditlog"("tijdstip");

-- CreateIndex
CREATE INDEX "Auditlog_entiteit_entiteitId_idx" ON "Auditlog"("entiteit", "entiteitId");
