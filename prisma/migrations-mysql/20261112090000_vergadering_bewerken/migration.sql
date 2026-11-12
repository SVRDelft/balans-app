-- Vergaderingen: locatie, status (gepland/verplaatst/afgelast) en volgnummer.
-- Alles met een standaardwaarde, dus bestaande rijen blijven geldig.
ALTER TABLE `Vergadering` ADD COLUMN `locatie` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'gepland',
    ADD COLUMN `volgnummer` INTEGER NULL;

-- Instellingen: de openbare Google-agenda en de sleutel van de agenda-feed.
ALTER TABLE `Instellingen` ADD COLUMN `googleAgendaUrl` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `agendaSleutel` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Instellingen_agendaSleutel_key` ON `Instellingen`(`agendaSleutel`);
