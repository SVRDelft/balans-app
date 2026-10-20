-- CreateTable
CREATE TABLE `Gebruiker` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `rol` VARCHAR(191) NOT NULL,
    `relatieId` VARCHAR(191) NULL,
    `wachtwoordHash` TEXT NOT NULL,
    `moetWijzigen` BOOLEAN NOT NULL DEFAULT true,
    `actief` BOOLEAN NOT NULL DEFAULT true,
    `laatsteInlog` DATETIME(3) NULL,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Gebruiker_email_key`(`email`),
    INDEX `Gebruiker_rol_idx`(`rol`),
    INDEX `Gebruiker_relatieId_idx`(`relatieId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inlogpoging` (
    `sleutel` VARCHAR(191) NOT NULL,
    `aantal` INTEGER NOT NULL DEFAULT 0,
    `eerstePoging` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `geblokkeerdTot` DATETIME(3) NULL,

    INDEX `Inlogpoging_geblokkeerdTot_idx`(`geblokkeerdTot`),
    PRIMARY KEY (`sleutel`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Gebruiker` ADD CONSTRAINT `Gebruiker_relatieId_fkey` FOREIGN KEY (`relatieId`) REFERENCES `Relatie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
