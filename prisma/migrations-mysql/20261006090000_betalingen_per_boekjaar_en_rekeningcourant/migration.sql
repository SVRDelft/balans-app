-- Betalingen horen bij een boekjaar, de rekening-courant komt erbij en een
-- boekjaar kan in reconstructie staan.

-- AlterTable: eerst leeg toestaan, zodat bestaande betalingen bijgewerkt kunnen
-- worden met het boekjaar van hun factuur.
ALTER TABLE `Betaling` ADD COLUMN `boekjaarId` VARCHAR(191) NULL;

UPDATE `Betaling` `b`
  JOIN `Factuur` `f` ON `f`.`id` = `b`.`factuurId`
  SET `b`.`boekjaarId` = `f`.`boekjaarId`
  WHERE `b`.`boekjaarId` IS NULL;

ALTER TABLE `Betaling` MODIFY COLUMN `boekjaarId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Bankmutatie` ADD COLUMN `rekeningpostId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Boekjaar` ADD COLUMN `reconstructie` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Rekeningpost` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `relatieId` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `viaBank` BOOLEAN NOT NULL DEFAULT true,
    `begrotingspostId` VARCHAR(191) NULL,
    `notities` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aangemaaktDoor` VARCHAR(191) NOT NULL DEFAULT '',
    `bijgewerktOp` DATETIME(3) NOT NULL,

    INDEX `Rekeningpost_boekjaarId_datum_idx`(`boekjaarId`, `datum`),
    INDEX `Rekeningpost_relatieId_idx`(`relatieId`),
    INDEX `Rekeningpost_begrotingspostId_idx`(`begrotingspostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Bankmutatie_rekeningpostId_key` ON `Bankmutatie`(`rekeningpostId`);

-- CreateIndex
CREATE INDEX `Betaling_boekjaarId_idx` ON `Betaling`(`boekjaarId`);

-- AddForeignKey
ALTER TABLE `Betaling` ADD CONSTRAINT `Betaling_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rekeningpost` ADD CONSTRAINT `Rekeningpost_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rekeningpost` ADD CONSTRAINT `Rekeningpost_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rekeningpost` ADD CONSTRAINT `Rekeningpost_begrotingspostId_fkey` FOREIGN KEY (`begrotingspostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_rekeningpostId_fkey` FOREIGN KEY (`rekeningpostId`) REFERENCES `Rekeningpost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
