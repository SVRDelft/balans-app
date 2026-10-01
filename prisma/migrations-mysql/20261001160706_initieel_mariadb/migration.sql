-- CreateTable
CREATE TABLE `Instellingen` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'svr',
    `organisatieNaam` VARCHAR(191) NOT NULL DEFAULT 'StudieVerenigingenRaad Delft',
    `adres` VARCHAR(191) NOT NULL DEFAULT '',
    `postcode` VARCHAR(191) NOT NULL DEFAULT '',
    `plaats` VARCHAR(191) NOT NULL DEFAULT 'Delft',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `iban` VARCHAR(191) NOT NULL DEFAULT '',
    `kvkNummer` VARCHAR(191) NOT NULL DEFAULT '',
    `contactpersoon` VARCHAR(191) NOT NULL DEFAULT '',
    `telefoon` VARCHAR(191) NOT NULL DEFAULT '',
    `website` VARCHAR(191) NOT NULL DEFAULT '',
    `land` VARCHAR(191) NOT NULL DEFAULT 'Nederland',
    `btwNummer` VARCHAR(191) NOT NULL DEFAULT '',
    `logoData` LONGBLOB NULL,
    `logoMimeType` VARCHAR(191) NULL,
    `logoNaam` TEXT NULL,
    `btwPlichtig` BOOLEAN NOT NULL DEFAULT false,
    `btwPercentage` INTEGER NOT NULL DEFAULT 21,
    `betaaltermijnDagen` INTEGER NOT NULL DEFAULT 30,
    `factuurVoetnoot` TEXT NOT NULL DEFAULT '',
    `bijgewerktOp` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Boekjaar` (
    `id` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `factuurPrefix` VARCHAR(191) NOT NULL,
    `startDatum` DATETIME(3) NOT NULL,
    `eindDatum` DATETIME(3) NOT NULL,
    `actief` BOOLEAN NOT NULL DEFAULT false,
    `beginsaldoBankCenten` INTEGER NOT NULL DEFAULT 0,
    `beginsaldoEigenVermogenCenten` INTEGER NOT NULL DEFAULT 0,
    `factuurTeller` INTEGER NOT NULL DEFAULT 0,
    `notities` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Boekjaar_naam_key`(`naam`),
    UNIQUE INDEX `Boekjaar_factuurPrefix_key`(`factuurPrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Relatie` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `contactpersoon` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `adres` VARCHAR(191) NULL,
    `postcode` VARCHAR(191) NULL,
    `plaats` VARCHAR(191) NULL,
    `land` VARCHAR(191) NOT NULL DEFAULT 'Nederland',
    `telefoon` VARCHAR(191) NOT NULL DEFAULT '',
    `website` VARCHAR(191) NOT NULL DEFAULT '',
    `kvkNummer` VARCHAR(191) NOT NULL DEFAULT '',
    `btwNummer` VARCHAR(191) NOT NULL DEFAULT '',
    `iban` VARCHAR(191) NOT NULL DEFAULT '',
    `actief` BOOLEAN NOT NULL DEFAULT true,
    `bijdragePlichtig` BOOLEAN NOT NULL DEFAULT false,
    `notities` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Relatie_naam_key`(`naam`),
    INDEX `Relatie_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Begrotingspost` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `categorie` VARCHAR(191) NOT NULL,
    `soort` VARCHAR(191) NOT NULL,
    `begrootCenten` INTEGER NOT NULL DEFAULT 0,
    `volgorde` INTEGER NOT NULL DEFAULT 0,
    `notities` TEXT NULL,

    INDEX `Begrotingspost_boekjaarId_categorie_soort_idx`(`boekjaarId`, `categorie`, `soort`),
    UNIQUE INDEX `Begrotingspost_boekjaarId_code_key`(`boekjaarId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Factuur` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `nummer` VARCHAR(191) NOT NULL,
    `volgnummer` INTEGER NOT NULL,
    `relatieId` VARCHAR(191) NOT NULL,
    `factuurdatum` DATETIME(3) NOT NULL,
    `vervaldatum` DATETIME(3) NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'concept',
    `soort` VARCHAR(191) NOT NULL DEFAULT 'normaal',
    `evenementId` VARCHAR(191) NULL,
    `omslagrondeId` VARCHAR(191) NULL,
    `crediteertFactuurId` VARCHAR(191) NULL,
    `totaalCenten` INTEGER NOT NULL DEFAULT 0,
    `notities` TEXT NULL,
    `verstuurdOp` DATETIME(3) NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Factuur_nummer_key`(`nummer`),
    UNIQUE INDEX `Factuur_crediteertFactuurId_key`(`crediteertFactuurId`),
    INDEX `Factuur_boekjaarId_status_idx`(`boekjaarId`, `status`),
    INDEX `Factuur_relatieId_idx`(`relatieId`),
    INDEX `Factuur_evenementId_idx`(`evenementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Factuurregel` (
    `id` VARCHAR(191) NOT NULL,
    `factuurId` VARCHAR(191) NOT NULL,
    `begrotingspostId` VARCHAR(191) NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `aantal` INTEGER NOT NULL DEFAULT 1,
    `prijsPerStukCenten` INTEGER NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `volgorde` INTEGER NOT NULL DEFAULT 0,

    INDEX `Factuurregel_factuurId_idx`(`factuurId`),
    INDEX `Factuurregel_begrotingspostId_idx`(`begrotingspostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Betaling` (
    `id` VARCHAR(191) NOT NULL,
    `factuurId` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `notitie` TEXT NULL,
    `geregistreerdOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `geregistreerdDoor` VARCHAR(191) NULL,

    INDEX `Betaling_factuurId_idx`(`factuurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Uitgave` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `relatieId` VARCHAR(191) NULL,
    `leverancierNaam` TEXT NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `begrotingspostId` VARCHAR(191) NOT NULL,
    `evenementId` VARCHAR(191) NULL,
    `bedragDefinitief` BOOLEAN NOT NULL DEFAULT false,
    `tenLasteVanSvr` BOOLEAN NOT NULL DEFAULT false,
    `omslagrondeId` VARCHAR(191) NULL,
    `betaald` BOOLEAN NOT NULL DEFAULT false,
    `betaaldOp` DATETIME(3) NULL,
    `notities` TEXT NULL,
    `bijlageId` VARCHAR(191) NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Uitgave_bijlageId_key`(`bijlageId`),
    INDEX `Uitgave_boekjaarId_idx`(`boekjaarId`),
    INDEX `Uitgave_evenementId_idx`(`evenementId`),
    INDEX `Uitgave_begrotingspostId_idx`(`begrotingspostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bijlage` (
    `id` VARCHAR(191) NOT NULL,
    `bestandsnaam` TEXT NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `grootte` INTEGER NOT NULL,
    `data` LONGBLOB NOT NULL,
    `geuploadOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `geuploadDoor` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evenement` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `kostenpostId` VARCHAR(191) NULL,
    `opbrengstpostId` VARCHAR(191) NULL,
    `notities` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    INDEX `Evenement_boekjaarId_idx`(`boekjaarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deelnemer` (
    `id` VARCHAR(191) NOT NULL,
    `evenementId` VARCHAR(191) NOT NULL,
    `relatieId` VARCHAR(191) NULL,
    `naam` VARCHAR(191) NOT NULL,
    `aantalPersonen` INTEGER NOT NULL DEFAULT 1,
    `aangemeld` BOOLEAN NOT NULL DEFAULT true,
    `bevestigdBetalend` BOOLEAN NOT NULL DEFAULT false,
    `notities` TEXT NULL,

    INDEX `Deelnemer_evenementId_idx`(`evenementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Omslagronde` (
    `id` VARCHAR(191) NOT NULL,
    `evenementId` VARCHAR(191) NOT NULL,
    `rondeNummer` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `berekendOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `berekendDoor` VARCHAR(191) NOT NULL,
    `totaalKostenCenten` INTEGER NOT NULL,
    `aantalAangemeld` INTEGER NOT NULL,
    `aantalBevestigd` INTEGER NOT NULL,
    `kostprijsPerPersoonCenten` INTEGER NOT NULL,
    `prijsPerPersoonCenten` INTEGER NOT NULL,
    `totaalGefactureerdCenten` INTEGER NOT NULL,
    `notities` TEXT NULL,

    UNIQUE INDEX `Omslagronde_evenementId_rondeNummer_key`(`evenementId`, `rondeNummer`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OmslagrondeDeelnemer` (
    `id` VARCHAR(191) NOT NULL,
    `omslagrondeId` VARCHAR(191) NOT NULL,
    `deelnemerId` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `aantalPersonen` INTEGER NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `factuurId` VARCHAR(191) NULL,

    INDEX `OmslagrondeDeelnemer_omslagrondeId_idx`(`omslagrondeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banksaldo` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `saldoCenten` INTEGER NOT NULL,
    `notitie` TEXT NULL,
    `ingevoerdOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ingevoerdDoor` VARCHAR(191) NULL,

    INDEX `Banksaldo_boekjaarId_datum_idx`(`boekjaarId`, `datum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bankimport` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `bestandHash` VARCHAR(191) NOT NULL,
    `bestandsnaam` TEXT NOT NULL,
    `rekening` VARCHAR(191) NOT NULL,
    `beginDatum` DATETIME(3) NOT NULL,
    `eindDatum` DATETIME(3) NOT NULL,
    `beginSaldoCenten` INTEGER NOT NULL,
    `eindSaldoCenten` INTEGER NOT NULL,
    `aantalRegels` INTEGER NOT NULL,
    `duplicaten` INTEGER NOT NULL DEFAULT 0,
    `bevestigdOp` DATETIME(3) NULL,
    `banksaldoId` VARCHAR(191) NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aangemaaktDoor` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Bankimport_bestandHash_key`(`bestandHash`),
    UNIQUE INDEX `Bankimport_banksaldoId_key`(`banksaldoId`),
    INDEX `Bankimport_boekjaarId_aangemaaktOp_idx`(`boekjaarId`, `aangemaaktOp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bankmutatie` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `sleutel` VARCHAR(191) NOT NULL,
    `rekening` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `tegenpartijNaam` TEXT NOT NULL DEFAULT '',
    `tegenpartijIban` VARCHAR(191) NOT NULL DEFAULT '',
    `bankReferentie` VARCHAR(191) NULL,
    `verwerking` VARCHAR(191) NOT NULL DEFAULT 'open',
    `notitie` TEXT NULL,
    `betalingId` VARCHAR(191) NULL,
    `uitgaveId` VARCHAR(191) NULL,
    `verwerktOp` DATETIME(3) NULL,
    `verwerktDoor` VARCHAR(191) NULL,

    UNIQUE INDEX `Bankmutatie_sleutel_key`(`sleutel`),
    UNIQUE INDEX `Bankmutatie_betalingId_key`(`betalingId`),
    UNIQUE INDEX `Bankmutatie_uitgaveId_key`(`uitgaveId`),
    INDEX `Bankmutatie_boekjaarId_verwerking_datum_idx`(`boekjaarId`, `verwerking`, `datum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voorraadpost` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `eenheid` VARCHAR(191) NOT NULL DEFAULT 'stuks',
    `beginAantal` INTEGER NOT NULL DEFAULT 0,
    `beginWaardePerStukCenten` INTEGER NOT NULL DEFAULT 0,
    `aantal` INTEGER NOT NULL DEFAULT 0,
    `waardePerStukCenten` INTEGER NOT NULL DEFAULT 0,
    `locatie` VARCHAR(191) NOT NULL DEFAULT '',
    `notities` TEXT NOT NULL DEFAULT '',
    `bijgewerktOp` DATETIME(3) NOT NULL,
    `begrotingspostId` VARCHAR(191) NULL,

    INDEX `Voorraadpost_boekjaarId_idx`(`boekjaarId`),
    INDEX `Voorraadpost_begrotingspostId_idx`(`begrotingspostId`),
    UNIQUE INDEX `Voorraadpost_boekjaarId_naam_key`(`boekjaarId`, `naam`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Auditlog` (
    `id` VARCHAR(191) NOT NULL,
    `tijdstip` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `gebruiker` VARCHAR(191) NOT NULL,
    `entiteit` VARCHAR(191) NOT NULL,
    `entiteitId` VARCHAR(191) NULL,
    `actie` VARCHAR(191) NOT NULL,
    `samenvatting` TEXT NOT NULL,
    `details` TEXT NULL,
    `boekjaarId` VARCHAR(191) NULL,

    INDEX `Auditlog_tijdstip_idx`(`tijdstip`),
    INDEX `Auditlog_entiteit_entiteitId_idx`(`entiteit`, `entiteitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Begrotingspost` ADD CONSTRAINT `Begrotingspost_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuur` ADD CONSTRAINT `Factuur_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuur` ADD CONSTRAINT `Factuur_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuur` ADD CONSTRAINT `Factuur_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuur` ADD CONSTRAINT `Factuur_omslagrondeId_fkey` FOREIGN KEY (`omslagrondeId`) REFERENCES `Omslagronde`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuur` ADD CONSTRAINT `Factuur_crediteertFactuurId_fkey` FOREIGN KEY (`crediteertFactuurId`) REFERENCES `Factuur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuurregel` ADD CONSTRAINT `Factuurregel_factuurId_fkey` FOREIGN KEY (`factuurId`) REFERENCES `Factuur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factuurregel` ADD CONSTRAINT `Factuurregel_begrotingspostId_fkey` FOREIGN KEY (`begrotingspostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Betaling` ADD CONSTRAINT `Betaling_factuurId_fkey` FOREIGN KEY (`factuurId`) REFERENCES `Factuur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_begrotingspostId_fkey` FOREIGN KEY (`begrotingspostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_omslagrondeId_fkey` FOREIGN KEY (`omslagrondeId`) REFERENCES `Omslagronde`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Uitgave` ADD CONSTRAINT `Uitgave_bijlageId_fkey` FOREIGN KEY (`bijlageId`) REFERENCES `Bijlage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evenement` ADD CONSTRAINT `Evenement_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evenement` ADD CONSTRAINT `Evenement_kostenpostId_fkey` FOREIGN KEY (`kostenpostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evenement` ADD CONSTRAINT `Evenement_opbrengstpostId_fkey` FOREIGN KEY (`opbrengstpostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deelnemer` ADD CONSTRAINT `Deelnemer_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deelnemer` ADD CONSTRAINT `Deelnemer_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Omslagronde` ADD CONSTRAINT `Omslagronde_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OmslagrondeDeelnemer` ADD CONSTRAINT `OmslagrondeDeelnemer_omslagrondeId_fkey` FOREIGN KEY (`omslagrondeId`) REFERENCES `Omslagronde`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OmslagrondeDeelnemer` ADD CONSTRAINT `OmslagrondeDeelnemer_deelnemerId_fkey` FOREIGN KEY (`deelnemerId`) REFERENCES `Deelnemer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OmslagrondeDeelnemer` ADD CONSTRAINT `OmslagrondeDeelnemer_factuurId_fkey` FOREIGN KEY (`factuurId`) REFERENCES `Factuur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Banksaldo` ADD CONSTRAINT `Banksaldo_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankimport` ADD CONSTRAINT `Bankimport_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankimport` ADD CONSTRAINT `Bankimport_banksaldoId_fkey` FOREIGN KEY (`banksaldoId`) REFERENCES `Banksaldo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `Bankimport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_betalingId_fkey` FOREIGN KEY (`betalingId`) REFERENCES `Betaling`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_uitgaveId_fkey` FOREIGN KEY (`uitgaveId`) REFERENCES `Uitgave`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voorraadpost` ADD CONSTRAINT `Voorraadpost_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voorraadpost` ADD CONSTRAINT `Voorraadpost_begrotingspostId_fkey` FOREIGN KEY (`begrotingspostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
