-- Inloggen als vereniging of informant met één gedeeld wachtwoord.

-- CreateTable
CREATE TABLE `Portaaltoegang` (
    `id` VARCHAR(191) NOT NULL,
    `sleutel` VARCHAR(191) NOT NULL,
    `groep` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `volgorde` INTEGER NOT NULL DEFAULT 0,
    `wachtwoordHash` TEXT NULL,
    `wachtwoordGewijzigdOp` DATETIME(3) NULL,
    `laatsteInlog` DATETIME(3) NULL,
    `actief` BOOLEAN NOT NULL DEFAULT true,
    `aangemaaktOp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bijgewerktOp` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Portaaltoegang_sleutel_key`(`sleutel`),
    INDEX `Portaaltoegang_groep_volgorde_idx`(`groep`, `volgorde`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- De twee informanten waar het mee begint. Zonder wachtwoord: het bestuur stelt
-- er een in bij Portaaltoegang, tot die tijd kan er niemand mee inloggen.
INSERT INTO `Portaaltoegang` (`id`, `sleutel`, `groep`, `naam`, `volgorde`, `actief`, `bijgewerktOp`)
VALUES
  ('informant-oras', 'oras', 'informant', 'ORAS', 1, true, CURRENT_TIMESTAMP(3)),
  ('informant-lijst-beta', 'lijst-beta', 'informant', 'Lijst Bèta', 2, true, CURRENT_TIMESTAMP(3));
