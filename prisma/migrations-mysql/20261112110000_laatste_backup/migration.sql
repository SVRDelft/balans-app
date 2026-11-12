-- Wanneer en door wie de volledige back-up voor het laatst is gedownload.
ALTER TABLE `Instellingen` ADD COLUMN `laatsteBackupOp` DATETIME(3) NULL,
    ADD COLUMN `laatsteBackupDoor` VARCHAR(191) NULL;
