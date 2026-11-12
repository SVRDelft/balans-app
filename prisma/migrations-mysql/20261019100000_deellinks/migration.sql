-- Agenda's en notulen delen via een geheime link, zonder inloggen.
ALTER TABLE `Portaalbestand` ADD COLUMN `deelsleutel` VARCHAR(191) NULL,
    ADD COLUMN `gedeeldOp` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Portaalbestand_deelsleutel_key` ON `Portaalbestand`(`deelsleutel`);
