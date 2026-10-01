-- CreateTable
CREATE TABLE `Mededeling` (
    `id` VARCHAR(191) NOT NULL,
    `titel` VARCHAR(191) NOT NULL,
    `tekst` TEXT NOT NULL,
    `geplaatstOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `geplaatstDoor` VARCHAR(191) NOT NULL,
    `bijgewerktOp` DATETIME(3) NOT NULL,

    INDEX `Mededeling_geplaatstOp_idx`(`geplaatstOp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vergadering` (
    `id` VARCHAR(191) NOT NULL,
    `reeks` VARCHAR(191) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `tijd` VARCHAR(191) NOT NULL DEFAULT '14:00',
    `gastheerId` VARCHAR(191) NULL,
    `gastheerNaam` VARCHAR(191) NOT NULL DEFAULT '',
    `notitie` TEXT NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    INDEX `Vergadering_datum_idx`(`datum`),
    INDEX `Vergadering_reeks_datum_idx`(`reeks`, `datum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Portaalbestand` (
    `id` VARCHAR(191) NOT NULL,
    `soort` VARCHAR(191) NOT NULL,
    `titel` VARCHAR(191) NOT NULL,
    `vergaderingId` VARCHAR(191) NULL,
    `bestandsnaam` TEXT NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `grootte` INTEGER NOT NULL,
    `opslagnaam` VARCHAR(191) NOT NULL,
    `geuploadOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `geuploadDoor` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Portaalbestand_opslagnaam_key`(`opslagnaam`),
    INDEX `Portaalbestand_vergaderingId_idx`(`vergaderingId`),
    INDEX `Portaalbestand_soort_geuploadOp_idx`(`soort`, `geuploadOp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vergadering` ADD CONSTRAINT `Vergadering_gastheerId_fkey` FOREIGN KEY (`gastheerId`) REFERENCES `Relatie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Portaalbestand` ADD CONSTRAINT `Portaalbestand_vergaderingId_fkey` FOREIGN KEY (`vergaderingId`) REFERENCES `Vergadering`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
