-- De spaarrekening: een beginsaldo per boekjaar, alle mutaties, en een
-- ingevoerd saldo per rekening om mee te vergelijken.

-- AlterTable
ALTER TABLE `Boekjaar` ADD COLUMN `beginsaldoSpaarCenten` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Banksaldo` ADD COLUMN `rekening` VARCHAR(191) NOT NULL DEFAULT 'betaal';

-- AlterTable
ALTER TABLE `Bankmutatie` ADD COLUMN `spaarmutatieId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Spaarmutatie` (
    `id` VARCHAR(191) NOT NULL,
    `boekjaarId` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `omschrijving` TEXT NOT NULL,
    `bedragCenten` INTEGER NOT NULL,
    `soort` VARCHAR(191) NOT NULL DEFAULT 'overboeking',
    `viaBetaalrekening` BOOLEAN NOT NULL DEFAULT true,
    `begrotingspostId` VARCHAR(191) NULL,
    `notities` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aangemaaktDoor` VARCHAR(191) NOT NULL DEFAULT '',
    `bijgewerktOp` DATETIME(3) NOT NULL,

    INDEX `Spaarmutatie_boekjaarId_datum_idx`(`boekjaarId`, `datum`),
    INDEX `Spaarmutatie_begrotingspostId_idx`(`begrotingspostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Bankmutatie_spaarmutatieId_key` ON `Bankmutatie`(`spaarmutatieId`);

-- AddForeignKey
ALTER TABLE `Spaarmutatie` ADD CONSTRAINT `Spaarmutatie_boekjaarId_fkey` FOREIGN KEY (`boekjaarId`) REFERENCES `Boekjaar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spaarmutatie` ADD CONSTRAINT `Spaarmutatie_begrotingspostId_fkey` FOREIGN KEY (`begrotingspostId`) REFERENCES `Begrotingspost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bankmutatie` ADD CONSTRAINT `Bankmutatie_spaarmutatieId_fkey` FOREIGN KEY (`spaarmutatieId`) REFERENCES `Spaarmutatie`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
