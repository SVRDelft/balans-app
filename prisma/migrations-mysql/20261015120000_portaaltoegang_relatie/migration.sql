-- Wie als vereniging inlogt, ziet de openstaande facturen van de relatie die
-- het bestuur hier koppelt.
ALTER TABLE `Portaaltoegang` ADD COLUMN `relatieId` VARCHAR(191) NULL;

CREATE INDEX `Portaaltoegang_relatieId_idx` ON `Portaaltoegang`(`relatieId`);

ALTER TABLE `Portaaltoegang` ADD CONSTRAINT `Portaaltoegang_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
